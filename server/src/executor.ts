import { cfg } from "./config.ts";
import { requestQuote, getStatus } from "./oneclick.ts";
import { withdrawTo } from "./strk20.ts";
import { putPlan } from "./store.ts";
import type { Plan, Chunk } from "./planner.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const running = new Set<string>();

export function isRunning(id: string): boolean {
  return running.has(id);
}

// Walk a plan chunk by chunk. Safe to call again after a crash/restart —
// completed chunks are skipped and a plan never runs twice concurrently.
export async function runPlan(plan: Plan): Promise<void> {
  if (running.has(plan.id)) return;
  running.add(plan.id);
  const update = (i: number, patch: Partial<Chunk>) => {
    plan.chunks[i] = { ...plan.chunks[i], ...patch };
    putPlan(plan);
  };
  try {
    for (let i = 0; i < plan.chunks.length; i++) {
      const c = plan.chunks[i];
      if (c.status === "success") continue;

      // Funds already left the pool for this chunk: a restart must resume the
      // existing intent, never broadcast a second withdrawal.
      if (c.txHash && c.depositAddress) {
        if (!(await settle(c.depositAddress, i, update))) return;
        continue;
      }

      // A chunk with a deposit address may have broadcast a withdrawal whose
      // hash we never persisted. PENDING_DEPOSIT only says nothing has arrived
      // *yet*, not that nothing was sent — retrying on that guess spends the
      // same notes twice. Stop and require a human to check the address.
      if (c.status !== "scheduled" && c.depositAddress) {
        const s = await getStatus(c.depositAddress).catch(() => null);
        if (s && s.status !== "PENDING_DEPOSIT") {
          if (!(await settle(c.depositAddress, i, update))) return;
          continue;
        }
        update(i, { status: "needs_check" });
        return;
      }

      if (c.status === "needs_check") return;

      if (c.status === "scheduled" && c.delayMs > 0) await sleep(c.delayMs);

      let depositAddress: string;
      try {
        update(i, { status: "quoting", error: undefined });
        const q = await requestQuote({
          amountWei: BigInt(c.amountWei),
          destinationAsset: plan.destAsset,
          recipient: plan.recipient,
          refundTo: plan.refundTo,
          dry: cfg.dryRun,
        });
        depositAddress = q.depositAddress;
        update(i, { depositAddress, amountOutFormatted: q.amountOutFormatted });
      } catch (e: any) {
        update(i, { status: "failed", error: `quote: ${e?.message ?? e}` });
        return;
      }

      try {
        update(i, { status: "withdrawing" });
        const txHash = await withdrawTo(BigInt(c.amountWei), depositAddress);
        update(i, { status: "bridging", txHash });
      } catch (e: any) {
        update(i, { status: "failed", error: `withdraw: ${e?.message ?? e}` });
        return;
      }

      if (cfg.dryRun) {
        update(i, { status: "success", destTxHash: "(dry run)" });
        continue;
      }

      if (!(await settle(depositAddress, i, update))) return;
    }
  } finally {
    running.delete(plan.id);
  }
}

// Polls one chunk's intent to a terminal state; false means the plan stops.
async function settle(
  depositAddress: string,
  i: number,
  update: (i: number, patch: Partial<Chunk>) => void,
): Promise<boolean> {
  for (let tries = 0; tries < 240; tries++) {
    await sleep(5000);
    try {
      const s = await getStatus(depositAddress);
      if (s.status === "SUCCESS") {
        update(i, { status: "success", destTxHash: s.destTxHash });
        return true;
      }
      if (s.status === "REFUNDED" || s.status === "FAILED") {
        update(i, { status: "failed", error: s.status });
        return false;
      }
    } catch {
      /* transient; keep polling */
    }
  }
  update(i, { status: "failed", error: "timeout waiting for settlement" });
  return false;
}
