// Resume must never broadcast a second withdrawal for a chunk whose funds
// already left the pool.
// Run: node --experimental-strip-types --experimental-test-module-mocks test-resume.mjs
import assert from "node:assert/strict";
import { mock } from "node:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DRY_RUN = "0";
process.env.API_TOKEN = "t";
process.env.STATE_FILE = join(mkdtempSync(join(tmpdir(), "mirage-")), "state.json");

let withdrawals = 0;
mock.module("./src/strk20.ts", {
  namedExports: {
    withdrawTo: async () => {
      withdrawals += 1;
      return "0xdeadbeef";
    },
    engineStatus: () => ({}),
  },
});
mock.module("./src/oneclick.ts", {
  namedExports: {
    requestQuote: async () => {
      throw new Error("resume must not re-quote a chunk that already withdrew");
    },
    getStatus: async () => ({ status: "SUCCESS", destTxHash: "0xdest" }),
  },
});

const { runPlan } = await import("./src/executor.ts");

const plan = {
  id: "11111111-1111-1111-1111-111111111111",
  createdAt: 0,
  destAsset: "nep141:base.omft.near",
  recipient: "0xrecipient",
  refundTo: "0xrefund",
  totalWei: "100",
  chunks: [
    // already settled — must be skipped entirely
    { amountWei: "40", delayMs: 0, status: "success", txHash: "0xa", depositAddress: "0xA" },
    // withdrawal broadcast, interrupted before settlement — must only poll
    { amountWei: "60", delayMs: 0, status: "bridging", txHash: "0xb", depositAddress: "0xB" },
  ],
};

await runPlan(plan);

assert.equal(withdrawals, 0, "resume re-broadcast a withdrawal for an in-flight chunk");
assert.equal(plan.chunks[0].status, "success");
assert.equal(
  plan.chunks[1].status,
  "success",
  "in-flight chunk should settle from its deposit address",
);
assert.equal(plan.chunks[1].destTxHash, "0xdest");
console.log("ok — resume settled 1 in-flight chunk with 0 new withdrawals");
