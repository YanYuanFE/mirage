// Pool operations via the Privacy SDK. This is the plug-in point for the
// mainnet proving service URL (strk20-hackathon issue #135): everything else
// in the engine runs today; withdrawTo() throws PROVING_NOT_CONFIGURED until
// the env is complete, and DRY_RUN=1 simulates it for end-to-end testing.
import { cfg, provingConfigured } from "./config.ts";

let transfersP: Promise<any> | null = null;

async function getTransfers(): Promise<{ transfers: any; account: any; provider: any }> {
  if (!provingConfigured()) {
    throw new Error(
      "PROVING_NOT_CONFIGURED: set PROVING_SERVICE_URL, ACCOUNT_ADDRESS, ACCOUNT_PRIVATE_KEY, VIEWING_KEY (waiting on issue #135)",
    );
  }
  if (!transfersP) {
    transfersP = (async () => {
      const { Account, RpcProvider, constants } = await import("starknet");
      // Published to GitHub Packages while StarkWare restores npm access —
      // see server/README.md for the one-time install steps.
      const sdk: any = await import("@starkware-libs/starknet-privacy-sdk" as string);
      const provider = new RpcProvider({ nodeUrl: cfg.rpcUrl });
      const account = new Account({
        provider,
        address: cfg.accountAddress,
        signer: cfg.accountPrivateKey,
        cairoVersion: "1",
      });
      const transfers = sdk.createPrivateTransfers({
        account,
        viewingKeyProvider: { getViewingKey: async () => BigInt(cfg.viewingKey) },
        provingProvider: {
          url: cfg.provingServiceUrl,
          chainId: constants.StarknetChainId.SN_MAIN,
        },
        ...(cfg.indexerUrl ? { discoveryProvider: { url: cfg.indexerUrl } } : {}),
        poolContractAddress: cfg.poolAddress,
      });
      return { transfers, account, provider };
    })();
  }
  return transfersP;
}

// Spend shielded STRK notes and pay `recipient` (a 1Click one-time deposit
// address) publicly, change back to our own notes. Returns the tx hash.
export async function withdrawTo(amountWei: bigint, recipient: string): Promise<string> {
  if (cfg.dryRun) {
    await new Promise((r) => setTimeout(r, 1500));
    return `0xdry${Date.now().toString(16)}`;
  }
  const { transfers, account, provider } = await getTransfers();
  const provingBlockId = (await provider.getBlockNumber()) - 10;
  const { callAndProof } = await transfers
    .build({ autoSelectNotes: "naive", autoDiscover: { notes: "refresh" } })
    .surplusTo(account.address)
    .with(cfg.strkToken, (t: any) => t.withdraw({ amount: amountWei, recipient }))
    .execute({ provingBlockId });
  const proofDetails = callAndProof.proof.proofFacts?.length
    ? { proofFacts: callAndProof.proof.proofFacts, proof: callAndProof.proof.data }
    : {};
  const tx = await account.execute(callAndProof.call, { tip: 0n, ...proofDetails });
  await provider.waitForTransaction(tx.transaction_hash);
  return tx.transaction_hash;
}

export function engineStatus() {
  return { dryRun: cfg.dryRun, provingConfigured: provingConfigured() };
}
