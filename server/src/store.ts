// ponytail: JSON file persistence; move to SQLite/Postgres if this outlives the sprint
import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { cfg } from "./config.ts";
import type { Plan } from "./planner.ts";

type State = { plans: Record<string, Plan> };

let state: State = { plans: {} };

export function load(): void {
  if (!existsSync(cfg.stateFile)) return;
  const raw = readFileSync(cfg.stateFile, "utf8");
  try {
    state = JSON.parse(raw);
  } catch (e) {
    // Starting empty would overwrite the file on the next save and lose every
    // in-flight plan — including chunks whose funds already left the pool.
    throw new Error(`state file ${cfg.stateFile} is unreadable, refusing to start: ${e}`);
  }
}

// Write to a temp file first: a crash mid-write would otherwise leave a
// truncated state file, which is the corruption case load() now refuses.
export function save(): void {
  const tmp = `${cfg.stateFile}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, cfg.stateFile);
}

export function putPlan(p: Plan): void {
  state.plans[p.id] = p;
  save();
}

export function getPlan(id: string): Plan | undefined {
  return state.plans[id];
}

export function allPlans(): Plan[] {
  return Object.values(state.plans).sort((a, b) => b.createdAt - a.createdAt);
}
