# Mirage — Architecture & Technical Design

_Last updated: 2026-08-20_

## 1. Overview

Mirage is a shielded omnichain wallet layer. A user shields tokens into the STRK20 privacy pool on Starknet, then sends value to any of 35+ chains through NEAR Intents — with no on-chain link between the user's main wallet, the funds leaving the pool, and the destination address.

Mirage is **not** a key-managing wallet. Users keep their existing Starknet wallet (ArgentX / Braavos). Mirage manages three things on top:

1. the user's shielded balance in the STRK20 pool (encrypted notes),
2. the exit itself — quoting, withdrawing, and following the transfer to the
   destination chain,
3. execution strategy (splitting, timing, routing) via a workflow engine.

## 2. Problem

Public chains leak everything: balances, counterparties, strategy, and the links between them. Cross-chain activity makes it worse — bridges create permanent, queryable paths between your identities on different chains. Existing mixers fix a single transfer on a single chain; bridges are fully transparent; CEXes offer privacy at the cost of custody.

Mirage's goal: **make "hard to link" the default property of moving value anywhere**, behind a UX no more complex than a normal wallet send.

### 2a. Prior art: ZODL

The closest shipped product is [ZODL](https://intents.near.org/case-studies/zodl),
a Zcash wallet that reaches 31 chains and 100+ assets over the same NEAR Intents
rail Mirage uses, and has earned $3M+ in fees doing it. That is worth stating
plainly: **the pattern is market-validated, not speculative** — a privacy asset
plus intent-based settlement is something people already pay for.

Three things make Mirage a different product rather than ZODL-for-Starknet:

| | ZODL | Mirage |
|---|---|---|
| What carries the privacy | the asset — you must hold ZEC | the pool — shield USDC, ETH, or any ERC-20 and stay in it |
| Custody | its own wallet, holding your keys | no keys; the user's existing wallet signs and proves |
| Per-transfer strategy | one signature, one swap | plan of randomized chunks with timing jitter (§5.4) |

The asset distinction is the substantive one. On ZODL, privacy costs you a
currency conversion — you are private only while denominated in ZEC. In a
shielded pool the token you deposited is the token you hold, so a treasury can
be private in USDC. Mirage converts to STRK only at the exit, and only because
1Click accepts nothing else out of Starknet (§3).

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
                                                      │
                                                      │ 3. withdraw STRK
                                                      ▼
                                            ┌───────────────────┐
                                            │ 1Click one-time    │  4. solvers fill
                                            │ deposit address    │─────────────────▶ destination chain,
                                            └───────────────────┘                   address you chose
```

Step by step:

1. **Shield** — user connects their existing wallet and shields any ERC-20 into the STRK20 pool. This is the only transaction their main wallet ever signs.
2. **Convert** — if the shielded asset isn't STRK, swap to STRK inside the pool through the AVNU anonymizer (`privacy_invoke`); result is credited back to private notes.
3. **Quote** — the workflow engine requests a 1Click quote (origin: Starknet STRK; destination: the chosen asset/chain/address) and gets back a one-time deposit address.
4. **Exit** — the pool withdrawal pays that deposit address directly. The ZK proof is what breaks the link to the depositor, so no intermediate hop is needed for unlinkability. _Not shipped:_ a fresh execution account, which would additionally isolate refunds (see below).
5. **Deliver** — NEAR Intents solvers fill the intent on the destination chain (dry-run measured estimate: ~27 s). Engine polls status until settled.

> **Refund leak (known, shipped behaviour).** `refundTo` is currently the user's
> own Starknet account. If an intent refunds, that refund lands on the main
> wallet and creates exactly the on-chain link the pool removed. A fresh
> execution account as the refund address closes this; until it ships, treat a
> refunded exit as deanonymising for that transfer.

Privacy boundary at each hop:

- main wallet ↔ pool exit: broken by the shielded pool,
- Starknet ↔ destination chain: no fixed bridge path; one-time deposit address per transfer,
- transfer ↔ transfer: broken by splitting and timing jitter (workflow engine, §6).

### 4a. Return leg (inbound)

The same rail runs in reverse, closing the round-trip needed to actually *use*
Mirage as execution infra (fund a fresh identity on Hyperliquid / Polymarket,
trade, bring proceeds home privately). 1Click delivers **to** Starknet — verified
by dry-run (Base USDC → Starknet STRK, ~39 s):

```
destination-chain asset (USDC on Base/Arb/Polygon, Hyperliquid proceeds …)
   │  1Click quote: origin = that asset, destination = Starknet STRK
   ▼
one-time deposit address on the source chain  ← user funds it
   │  solvers deliver
   ▼
STRK on the user's Starknet account (public)
   │  shield (deposit into the pool)
   ▼
shielded balance, topped back up
```

The trading identity on the destination stays unlinkable; the return only
credits the shielded balance. The final shield is a normal pool deposit the user
signs. In-app both directions live under one **Swap** tab with a
Shielded→Chain / Chain→Shielded toggle: the inbound side asks for source
chain/asset/amount + a refund address, returns a deposit address to fund, and
shields the arrived STRK. No EVM wallet integration is required — the user sends
from wherever the funds already are.

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

### 5.4 Workflow engine

Executes a send as a plan, not a single transfer:

- **Splitting** — break the amount into N chunks with randomized sizes.
- **Timing jitter** — randomized delays between chunks.
- **Per-chunk isolation** — each chunk gets its own 1Click quote and one-time deposit address.
- **Orchestration & recovery** — per-chunk state machine (quote → withdraw → settle), resumable after reload.

Two phases:

1. **Browser phase (shipped)** — `app/src/lib/engine.ts`. The plan runs client-side; each chunk's pool withdrawal goes through the user's wallet (one approval per chunk, relayer-submitted on-chain). State persists in localStorage so an interrupted plan resumes.
2. **Headless phase (scaffolded in `server/`, live withdrawals blocked on the mainnet proving URL, issue #135)** — the same plan model server-side: node:http API (`POST /plans`), JSON-file persistence, restart-resume, real 1Click quoting today via `DRY_RUN=1`. `server/src/strk20.ts` is the single plug-in point: fill `PROVING_SERVICE_URL` + engine account env and withdrawals go live. This is the component that ships into the TEE (§8).

   Its trust model today is a **single-tenant** one: the engine spends its own
   pool balance, and `API_TOKEN` (required whenever `DRY_RUN` is off) gates every
   route. There is no per-user identity, spend limit, or plan ownership — so it
   is safe to run for yourself, not to expose as a shared service. The
   user-authorisation model that multi-tenant operation needs is designed in §8
   and unimplemented.

**Resume safety.** A chunk that already has a withdrawal transaction is never
withdrawn again: on resume the executor re-attaches to that chunk's existing
deposit address and polls it to settlement.

A chunk that has a deposit address but no recorded hash is the dangerous case,
and it is deliberately **not** retried. `PENDING_DEPOSIT` only means nothing has
arrived *yet* — a broadcast withdrawal can still be pending — so treating it as
"never sent" is how the same notes get spent twice. Such a chunk is parked as
`needs_check` and the plan stops; only a human who has looked at the deposit
address can clear it.

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

1. ~~**Can unshield target an arbitrary address?**~~ Resolved on mainnet: it can. Withdrawals pay 1Click's one-time deposit address directly, which is what the shipped exit does.
2. **Atomic exit adapter** — can a custom anonymizer make "unshield + transfer to deposit address" one transaction? Worth building only after the two-step version works; it is the strongest possible answer to the "integration depth" criterion (30 %).
3. **1Click JWT turnaround** — apply immediately; fall back to the 0.2 % fee if it doesn't arrive in time.

## 9a. Roadmap

Each item below is one missing dependency away, not one idea away — so each is
listed with what actually blocks it.

**1. Starknet as the privacy hub for every chain.** Both legs already run: value
enters from any of 35 chains (§4a) and leaves to any of them (§4), which makes an
EVM→EVM private transfer a round trip through the pool. The gap is that the user
needs a Starknet wallet in the middle. A Starknet account derived from the user's
existing EVM or Solana signature removes that — this is what organizer idea
IDEA-06 describes — but a derived account has to prove its own withdrawals, so it
needs the self-custodial proving service tracked in #135.

**2. TEE-verified execution (§8).** The workflow engine is the last party in the
design that can see anything — it holds the user's full plan — and remote
attestation is what closes that gap. The engine is already containerized. Two
things block the deploy: the same proving URL, and a hardware one worth recording
because it is not documented anywhere else — the official prover image requires
**AVX-512** on x86 and **SVE** on arm64. We reproduced `SIGILL` on four
environments (two VPS, Apple Silicon, and both Phala TDX nodes, which are Sierra
Forest and have no AVX-512); disassembly confirms `vmovups %zmm` and `z0.d`
operands in the shipped binaries. A portable build would unblock self-hosting.

**3. From settlement to execution.** Delivering value somewhere is not acting
there. Funding a fresh, unlinkable identity that then trades on a venue is the
difference between a privacy gateway and a privacy execution layer; a dry-run
quote confirms NEAR Intents delivers USDC directly onto Hyperliquid's HyperCore
trading layer (~37 s), so the rail exists. It needs the fresh execution account
(§4) and honest scoping: a position on a venue stays public — what Mirage removes
is the link between that position and you.

## 10. Judging criteria mapping

| Criterion | Weight | Mirage's answer |
|---|---|---|
| STRK20 integration depth | 30 % | pool (shield/unshield/private transfer) + Wallet API + AVNU anonymizer swap + (stretch) custom adapter |
| Working mainnet product | 30 % | live mainnet flow from day 3; no testnet exists for 1Click, so everything is real |
| Innovation | 25 % | first STRK20 → NEAR Intents privacy gateway; the only sprint project on that rail, and the rail itself is proven — ZODL earns $3M+ in fees on it for Zcash (§2a), so this is an unserved market rather than an untested idea |
| Docs & open-source quality | 15 % | this document, MIT license, reproducible scripts |
