// Mirage headless workflow engine. Plain node:http — no framework needed.
// Runs today with DRY_RUN=1; live pool withdrawals unlock when the proving
// service env is filled in (see strk20.ts / issue #135).
import { createServer } from "node:http";
import { cfg } from "./config.ts";
import { buildPlan } from "./planner.ts";
import { engineStatus } from "./strk20.ts";
import { load, putPlan, getPlan, allPlans } from "./store.ts";
import { runPlan, isRunning } from "./executor.ts";

load();

// Resume plans interrupted by a restart.
for (const p of allPlans()) {
  if (p.chunks.some((c) => c.status !== "success" && c.status !== "failed")) {
    void runPlan(p);
  }
}

function json(res: any, code: number, body: unknown): void {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body, null, 2));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, { ok: true, ...engineStatus() });
  }

  if (req.method === "GET" && url.pathname === "/plans") {
    return json(res, 200, allPlans());
  }

  const m = url.pathname.match(/^\/plans\/([0-9a-f-]+)$/);
  if (req.method === "GET" && m) {
    const p = getPlan(m[1]);
    return p
      ? json(res, 200, { ...p, running: isRunning(p.id) })
      : json(res, 404, { error: "not found" });
  }

  if (req.method === "POST" && url.pathname === "/plans") {
    let body = "";
    for await (const chunk of req) body += chunk;
    let input: any;
    try {
      input = JSON.parse(body);
    } catch {
      return json(res, 400, { error: "invalid JSON" });
    }
    const { totalWei, destAsset, recipient, refundTo, chunkCount, maxJitterMs } = input;
    if (!totalWei || !destAsset || !recipient) {
      return json(res, 400, { error: "totalWei, destAsset, recipient are required" });
    }
    const plan = buildPlan({
      totalWei: BigInt(totalWei),
      destAsset,
      recipient,
      refundTo: refundTo ?? cfg.accountAddress,
      chunkCount: chunkCount ?? 3,
      maxJitterMs,
    });
    putPlan(plan);
    void runPlan(plan);
    return json(res, 201, plan);
  }

  json(res, 404, { error: "not found" });
});

server.listen(cfg.port, () => {
  const s = engineStatus();
  console.log(
    `mirage-engine on :${cfg.port} | dryRun=${s.dryRun} | provingConfigured=${s.provingConfigured}`,
  );
});
