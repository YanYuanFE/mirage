// ponytail: JSON file persistence; move to SQLite/Postgres if this outlives the sprint
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { cfg } from "./config.ts";
import type { Plan } from "./planner.ts";

type State = { plans: Record<string, Plan> };

let state: State = { plans: {} };

export function load(): void {
  if (existsSync(cfg.stateFile)) {
    try {
      state = JSON.parse(readFileSync(cfg.stateFile, "utf8"));
    } catch {
      state = { plans: {} };
    }
  }
}

export function save(): void {
  writeFileSync(cfg.stateFile, JSON.stringify(state, null, 2));
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
