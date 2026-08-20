# Mirage workflow engine (headless)

The server-side phase of the Mirage workflow engine: takes one cross-chain
intent, executes it as a randomized split plan (sizes + timing jitter), one
1Click deposit address per chunk, resumable across restarts.

## Run

```sh
cp .env.example .env   # fill in what you have
DRY_RUN=1 node src/server.ts
```

Requires Node >= 24 (native TS type stripping + WebCrypto).

## API

- `GET  /health` — `{ok, dryRun, provingConfigured}`
- `POST /plans`  — `{totalWei, destAsset, recipient, chunkCount?, maxJitterMs?}`
- `GET  /plans` / `GET /plans/:id`

## Proving (the one missing piece)

Live pool withdrawals need the mainnet proving service URL — requested in
[strk20-hackathon#135](https://github.com/starkience/strk20-hackathon/issues/135).
Until it lands, `DRY_RUN=1` exercises the full loop with dry 1Click quotes and
simulated withdrawals. When it lands:

```sh
gh auth refresh -h github.com -s read:packages
npm config set @starkware-libs:registry https://npm.pkg.github.com
npm config set '//npm.pkg.github.com/:_authToken' "$(gh auth token)"
npm install @starkware-libs/starknet-privacy-sdk

# fill PROVING_SERVICE_URL / ACCOUNT_* / VIEWING_KEY in .env, drop DRY_RUN
node src/server.ts
```
