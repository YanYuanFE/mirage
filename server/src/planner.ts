// Plan model + randomized splitting. Mirrors app/src/lib/engine.ts so the two
// phases stay behaviorally identical.
import { webcrypto as crypto } from "node:crypto";

export type ChunkStatus =
  | "scheduled"
  | "quoting"
  | "withdrawing"
  | "bridging"
  | "success"
  | "failed";

export type Chunk = {
  amountWei: string;
  delayMs: number;
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
  recipient: string;
  refundTo: string;
  totalWei: string;
  chunks: Chunk[];
};

function rand(): number {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return b[0] / 0xffffffff;
}

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
  out.push(total - assigned);
  return out;
}

export function buildPlan(opts: {
  totalWei: bigint;
  destAsset: string;
  recipient: string;
  refundTo: string;
  chunkCount: number;
  maxJitterMs?: number;
}): Plan {
  const jitter = opts.maxJitterMs ?? 90_000;
  const amounts = splitAmount(opts.totalWei, Math.max(1, Math.min(10, opts.chunkCount)));
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    destAsset: opts.destAsset,
    recipient: opts.recipient,
    refundTo: opts.refundTo,
    totalWei: opts.totalWei.toString(),
    chunks: amounts.map((a, i) => ({
      amountWei: a.toString(),
      delayMs: i === 0 ? 0 : Math.floor((0.3 + 0.7 * rand()) * jitter),
      status: "scheduled" as const,
    })),
  };
}
