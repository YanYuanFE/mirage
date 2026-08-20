# Mirage — Architecture & Technical Design

_Last updated: 2026-08-20_

## 1. Overview

Mirage is a shielded omnichain wallet layer. A user shields tokens into the STRK20 privacy pool on Starknet, then sends value to any of 35+ chains through NEAR Intents — with no on-chain link between the user's main wallet, the funds leaving the pool, and the destination address.

Mirage is **not** a key-managing wallet. Users keep their existing Starknet wallet (ArgentX / Braavos). Mirage manages three things on top:

1. the user's shielded balance in the STRK20 pool (encrypted notes),
2. one-time execution accounts used to exit the pool,
3. execution strategy (splitting, timing, routing) via a workflow engine.

## 2. Problem

Public chains leak everything: balances, counterparties, strategy, and the links between them. Cross-chain activity makes it worse — bridges create permanent, queryable paths between your identities on different chains. Existing mixers fix a single transfer on a single chain; bridges are fully transparent; CEXes offer privacy at the cost of custody.

Mirage's goal: **make "hard to link" the default property of moving value anywhere**, behind a UX no more complex than a normal wallet send.

## 3. Building blocks (all verified live)

| Primitive | Provider | Status |
|---|---|---|
| Shielded pool, any ERC-20: shield / unshield / private in-pool transfer | STRK20 (Starknet mainnet) | Live |
| Private in-pool swap via anonymizer adapters (`privacy_invoke`, AVNU/Ekubo) | STRK20 | Live |
| Intent-based cross-chain execution, 35 chains / 186 assets | NEAR Intents 1Click API | Live (Starknet origin verified by dry-run quote, 2026-08-18) |
| Private sub-accounts / stealth accounts | STRK20 | Not shipped — not a dependency |
| TEE runtime for the workflow engine | Phala Cloud | In-sprint stretch (see §8) |

Key constraint verified against the 1Click token list: **on Starknet, 1Click accepts only STRK (plus wrapped ZEC/XRP) as origin asset.** All exits therefore convert to STRK in-pool before leaving. Destination side offers 186 assets across 35 chains (BTC, ETH, SOL, USDC/USDT on all major chains, etc.).

## 4. End-to-end flow

```
┌──────────────┐  1. shield any ERC-20      ┌───────────────────┐
│ Main wallet   │ ─────────────────────────▶│  STRK20 pool       │
│ (ArgentX etc.)│                            │  (encrypted notes) │
└──────────────┘                            └─────────┬─────────┘
                                                      │ 2. private swap → STRK
                                                      │    (AVNU anonymizer)
                                                      ▼
                                            ┌───────────────────┐
                                            │ Fresh execution    │  3. private in-pool
                                            │ account            │◀── transfer + unshield
                                            └─────────┬─────────┘
                                                      │ 4. deposit STRK
                                                      ▼
                                            ┌───────────────────┐
                                            │ 1Click one-time    │  5. solvers fill
                                            │ deposit address    │─────────────────▶ destination chain,
                                            └───────────────────┘                   fresh address
```

Step by step:

1. **Shield** — user connects their existing wallet and shields any ERC-20 into the STRK20 pool. This is the only transaction their main wallet ever signs.
2. **Convert** — if the shielded asset isn't STRK, swap to STRK inside the pool through the AVNU anonymizer (`privacy_invoke`); result is credited back to private notes.
3. **Exit** — private in-pool transfer to a fresh execution account, which unshields. The fresh-account hop makes the flow work even if unshield turns out to be restricted to self (open question §9).
4. **Quote & deposit** — workflow engine requests a 1Click quote (origin: Starknet STRK; destination: user's chosen asset/chain/address) and sends the unshielded STRK to the returned one-time deposit address.
5. **Deliver** — NEAR Intents solvers fill the intent on the destination chain (dry-run measured estimate: ~27 s). Engine polls status until settled; refunds return to the fresh account, never the main wallet.

Privacy boundary at each hop:

- main wallet ↔ pool exit: broken by the shielded pool,
- Starknet ↔ destination chain: no fixed bridge path; one-time deposit address per transfer,
- transfer ↔ transfer: broken by splitting and timing jitter (workflow engine, §6).

## 5. Components

### 5.1 Web app (Vite + React)

- Wallet connect (starknet.js). The official STRK20 starter kit is Next.js; its integration logic (wallet picker, shield/unshield, `privacy_invoke` helper) is framework-agnostic starknet.js code and is ported, not depended on.
- Shielded balance view, shield/unshield, and one primary action: **Send privately** — pick destination chain, asset, address; show quote (amount out, fee, ETA); track progress.
- No keys, no custody: all pool operations go through the STRK20 Wallet API route, which never touches user keys.

### 5.2 STRK20 integration

- **Wallet API** for shield / unshield / private transfer / note state.
- **Anonymizer (`privacy_invoke`)** for in-pool swap to STRK.
- Deepest-integration stretch goal: a custom anonymizer adapter that makes "unshield → transfer to 1Click deposit address" atomic (§9.2).

### 5.3 Cross-chain execution (1Click API)

- `GET /v0/tokens` — supported asset list (cached; drives the destination picker).
- `POST /v0/quote` — quote with `originAsset` = Starknet STRK, `depositType: ORIGIN_CHAIN`, destination asset/address; returns amounts, fees, ETA and the deposit address.
- Status polling until settlement; JWT requested from the NEAR Intents team to waive the 0.2 % no-auth fee.
- `appFees` field gives Mirage a built-in revenue mechanism (basis points per transfer).
- No testnet exists — all integration testing is small-amount mainnet, which also satisfies the sprint's mainnet-transaction requirement.

### 5.4 Workflow engine (Node.js service)

Executes a send as a plan, not a single transfer:

- **Splitting** — break the amount into N chunks with randomized sizes.
- **Timing jitter** — randomized delays between chunks.
- **Fresh accounts** — derive a new execution account per chunk.
- **Orchestration & recovery** — per-chunk state machine (quote → deposit → settle), retry, refund handling.

State in SQLite. <!-- ponytail: SQLite + single service; move to Postgres/queue if this outlives the sprint -->

## 6. Privacy model & honest limitations

What an observer sees and cannot do:

| Observer | Sees | Cannot |
|---|---|---|
| Starknet explorer | wallet X shielded 500 USDC; some account unshielded STRK later | link X to the unshield, or to any destination |
| Destination-chain explorer | fresh address received asset from solver | trace back through the intent to Starknet, or to X |
| NEAR Intents solver | amount + destination of a single chunk | see who funded it (source is a fresh, unlinkable account) |

Known limitations (stated openly in the demo):

- **Amount/timing correlation** — if you shield 1,000 STRK and 1,000 STRK-worth arrives on Base a minute later, statistics link them. Splitting + jitter raises the cost of this attack; it does not make it impossible. Anonymity grows with pool usage.
- **Solver visibility** — solvers see individual chunk intents. They cannot aggregate them to a user identity, but per-chunk metadata (destination address) is visible to the filling solver by design.
- **Mirage backend visibility** — the workflow engine sees the user's full plan. This is exactly the trust gap the TEE deployment (§8) closes; the engine is also open source and self-hostable.

## 7. Delivery plan (→ Aug 31, 23:59 UTC)

| Days | Goal | Verify |
|---|---|---|
| Aug 20–23 | Vertical slice on mainnet: shield STRK → private transfer → unshield → 1Click → USDC on Base, driven by scripts | 3+ mainnet txs recorded in `strk20.json` |
| Aug 24–27 | Web app: connect, shield, private send UI, live status; workflow engine with split + jitter | end-to-end demo through the UI, public deploy |
| Aug 28–30 | In-pool AVNU swap (any-ERC-20 entry); TEE deploy of the engine on Phala Cloud (§8); README/docs, 3-min demo video | `strk20.json` complete; attestation visible in UI |
| Aug 31 | Buffer | final repo state is the submission |

Stretch (only if ahead of schedule): custom anonymizer adapter (§9.2).

## 8. TEE (in-sprint stretch goal)

The original "Private Superapp" sketch called for a TEE workflow engine. The commonly cited framework (NEAR Shade Agents) was deprecated in April 2026, so Mirage targets a direct **Phala Cloud** deployment instead: the workflow engine ships as a Docker image into a confidential VM with remote attestation, so users can verify the exact code that sees their execution plans.

Minimal in-sprint scope (Aug 28–30, only after the core flow and UI are done):

1. containerize the workflow engine (it is already a single stateless-per-plan Node service),
2. deploy to a Phala Cloud CVM,
3. surface the attestation quote in the web app so the demo can prove where the engine runs.

Key rotation, reproducible builds, and attestation policy hardening remain post-sprint. If the stretch window is lost to core-flow work, the engine still ships open-source and self-hostable, and this section becomes the roadmap.

## 9. Open questions

1. **Can unshield target an arbitrary address?** Docs don't say. Mitigation already in the flow: private transfer to a fresh account first, which unshields to itself. Resolve in the Aug 20–23 slice.
2. **Atomic exit adapter** — can a custom anonymizer make "unshield + transfer to deposit address" one transaction? Worth building only after the two-step version works; it is the strongest possible answer to the "integration depth" criterion (30 %).
3. **1Click JWT turnaround** — apply immediately; fall back to the 0.2 % fee if it doesn't arrive in time.

## 10. Judging criteria mapping

| Criterion | Weight | Mirage's answer |
|---|---|---|
| STRK20 integration depth | 30 % | pool (shield/unshield/private transfer) + Wallet API + AVNU anonymizer swap + (stretch) custom adapter |
| Working mainnet product | 30 % | live mainnet flow from day 3; no testnet exists for 1Click, so everything is real |
| Innovation | 25 % | first STRK20 → NEAR Intents privacy gateway; organizer-endorsed direction, unbuilt on the leaderboard |
| Docs & open-source quality | 15 % | this document, MIT license, reproducible scripts |
