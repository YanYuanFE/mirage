export const cfg = {
  port: Number(process.env.PORT ?? 8787),
  rpcUrl: process.env.RPC_URL ?? "https://api.zan.top/public/starknet-mainnet/rpc/v0_10",
  poolAddress:
    process.env.POOL_ADDRESS ??
    "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a",
  strkToken:
    "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
  // The three SDK-route secrets. provingServiceUrl is the one blocker —
  // pending from the organizers (strk20-hackathon issue #135).
  provingServiceUrl: process.env.PROVING_SERVICE_URL ?? "",
  indexerUrl: process.env.INDEXER_URL ?? "",
  accountAddress: process.env.ACCOUNT_ADDRESS ?? "",
  accountPrivateKey: process.env.ACCOUNT_PRIVATE_KEY ?? "",
  viewingKey: process.env.VIEWING_KEY ?? "",
  oneClickJwt: process.env.ONECLICK_JWT ?? "",
  dryRun: process.env.DRY_RUN === "1",
  stateFile: process.env.STATE_FILE ?? new URL("../state.json", import.meta.url).pathname,
};

export function provingConfigured(): boolean {
  return Boolean(
    cfg.provingServiceUrl && cfg.accountAddress && cfg.accountPrivateKey && cfg.viewingKey,
  );
}
