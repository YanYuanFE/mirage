// Mirage workflow engine (browser phase): turns one cross-chain intent into an
// executable plan — randomized amount splits, jittered timing, one one-time
// deposit address per chunk. Survives reloads via localStorage.
// Server/TEE phase replaces the executor's wallet calls with SDK proving.

import { requestQuote, getStatus, type Quote } from "./oneclick";

export type ChunkStatus =
  | "scheduled"
  | "quoting"
  | "awaiting_wallet"
  | "bridging"
  | "success"
  | "failed";

export type Chunk = {
  amountWei: string; // bigint as string (JSON-safe)
  delayMs: number; // delay after previous chunk completes
  status: ChunkStatus;
  depositAddress?: string;
  amountOutFormatted?: string;
  txHash?: string;
  destTxHash?: string;
  error?: string;
};

export type Plan = {
  id: string;
  createdAt: number;
  destAsset: string;
  destLabel: string;
  recipient: string;
  refundTo: string;
  totalWei: string;
  chunks: Chunk[];
};

const STORE_KEY = "mirage.plan";

function rand(): number {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return b[0] / 0xffffffff;
}

// Split total into n chunks with randomized sizes (each 20%+ of an even share).
export function splitAmount(total: bigint, n: number): bigint[] {
  const weights = Array.from({ length: n }, () => 0.2 + rand());
  const sum = weights.reduce((a, b) => a + b, 0);
  const out: bigint[] = [];
  let assigned = 0n;
  for (let i = 0; i < n - 1; i++) {
    const share = (total * BigInt(Math.floor((weights[i] / sum) * 1e6))) / 1000000n;
    out.push(share);
    assigned += share;
  }
  out.push(total - assigned); // remainder keeps the sum exact
  return out;
}

export function buildPlan(opts: {
  totalWei: bigint;
  destAsset: string;
  destLabel: string;
  recipient: string;
  refundTo: string;
  chunkCount: number;
  maxJitterMs?: number; // default 90s between chunks
}): Plan {
  const jitter = opts.maxJitterMs ?? 90_000;
  const amounts = splitAmount(opts.totalWei, opts.chunkCount);
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    destAsset: opts.destAsset,
    destLabel: opts.destLabel,
    recipient: opts.recipient,
    refundTo: opts.refundTo,
    totalWei: opts.totalWei.toString(),
    chunks: amounts.map((a, i) => ({
      amountWei: a.toString(),
      delayMs: i === 0 ? 0 : Math.floor((0.3 + 0.7 * rand()) * jitter),
      status: "scheduled",
    })),
  };
}

export function savePlan(p: Plan | null) {
  if (p) localStorage.setItem(STORE_KEY, JSON.stringify(p));
  else localStorage.removeItem(STORE_KEY);
}

export function loadPlan(): Plan | null {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Walks the plan chunk by chunk. `withdraw` submits the pool withdrawal via the
// user's wallet and resolves to the tx hash. `onUpdate` fires on every state
// change (already-persisted). Resumable: completed chunks are skipped.
export async function executePlan(
  plan: Plan,
  withdraw: (
    amountWei: bigint,
    depositAddress: string,
    onSubmitted?: (txHash: string) => void,
  ) => Promise<string>,
  onUpdate: (p: Plan) => void,
): Promise<Plan> {
  const update = (patch: Partial<Chunk>, i: number) => {
    plan.chunks[i] = { ...plan.chunks[i], ...patch };
    savePlan(plan);
    onUpdate({ ...plan, chunks: [...plan.chunks] });
  };

  // Polls one chunk's 1Click intent to a terminal state. Returns false once the
  // chunk is settled as failed/timed out (caller stops the plan).
  const settle = async (depositAddress: string, i: number): Promise<boolean> => {
    for (let tries = 0; tries < 120; tries++) {
      await sleep(5000);
      try {
        const s = await getStatus(pad(depositAddress));
        if (s.status === "SUCCESS") {
          update(
            {
              status: "success",
              destTxHash: s.swapDetails?.destinationChainTxHashes?.[0]?.hash,
            },
            i,
          );
          return true;
        }
        if (s.status === "REFUNDED" || s.status === "FAILED") {
          update({ status: "failed", error: s.status }, i);
          return false;
        }
      } catch {
        /* keep polling */
      }
    }
    update({ status: "failed", error: "timeout waiting for settlement" }, i);
    return false;
  };

  for (let i = 0; i < plan.chunks.length; i++) {
    const c = plan.chunks[i];
    if (c.status === "success") continue;

    // Money already left the pool for this chunk — never withdraw again on
    // resume; pick the intent back up from its existing deposit address.
    if (c.txHash && c.depositAddress) {
      if (!(await settle(c.depositAddress, i))) return plan;
      continue;
    }

    // Interrupted while the wallet dialog was open: we never saw a hash, so ask
    // 1Click whether the funds arrived before risking a second withdrawal.
    if (c.status === "awaiting_wallet" && c.depositAddress) {
      const s = await getStatus(pad(c.depositAddress)).catch(() => null);
      if (s && s.status !== "PENDING_DEPOSIT") {
        if (!(await settle(c.depositAddress, i))) return plan;
        continue;
      }
    }

    if (c.status === "scheduled" && c.delayMs > 0) await sleep(c.delayMs);

    let quote: Quote;
    try {
      update({ status: "quoting", error: undefined }, i);
      quote = await requestQuote({
        amountWei: BigInt(c.amountWei),
        destinationAsset: plan.destAsset,
        recipient: plan.recipient,
        refundTo: plan.refundTo,
      });
    } catch (e: any) {
      update({ status: "failed", error: `quote: ${e?.message ?? e}` }, i);
      return plan;
    }
    update(
      {
        depositAddress: quote.depositAddress,
        amountOutFormatted: quote.amountOutFormatted,
      },
      i,
    );

    try {
      update({ status: "awaiting_wallet" }, i);
      // Persist the hash the moment it exists: if we die while waiting for the
      // block, resume must know this chunk already withdrew.
      const txHash = await withdraw(BigInt(c.amountWei), quote.depositAddress, (h) =>
        update({ status: "bridging", txHash: h }, i),
      );
      update({ status: "bridging", txHash }, i);
    } catch (e: any) {
      update({ status: "failed", error: `wallet: ${e?.message ?? e}` }, i);
      return plan;
    }

    if (!(await settle(quote.depositAddress, i))) {
      return plan;
    }
  }
  return plan;
}

// Starknet felts drop leading zeros; the 1Click status API wants 66 chars.
function pad(addr: string): string {
  return "0x" + addr.replace(/^0x/, "").padStart(64, "0");
}
