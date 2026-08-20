import { cfg } from "./config.ts";

const BASE = "https://1click.chaindefuser.com";
export const STARKNET_STRK_ASSET = "nep141:starknet.omft.near";

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(cfg.oneClickJwt ? { Authorization: `Bearer ${cfg.oneClickJwt}` } : {}),
  };
}

export type Quote = {
  depositAddress: string;
  amountOutFormatted: string;
  timeEstimate: number;
};

export async function requestQuote(opts: {
  amountWei: bigint;
  destinationAsset: string;
  recipient: string;
  refundTo: string;
  dry?: boolean;
}): Promise<Quote> {
  const r = await fetch(`${BASE}/v0/quote`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      dry: opts.dry ?? false,
      swapType: "EXACT_INPUT",
      slippageTolerance: 100,
      originAsset: STARKNET_STRK_ASSET,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: opts.destinationAsset,
      amount: opts.amountWei.toString(),
      refundTo: opts.refundTo,
      refundType: "ORIGIN_CHAIN",
      recipient: opts.recipient,
      recipientType: "DESTINATION_CHAIN",
      deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }),
  });
  const data: any = await r.json();
  if (!r.ok) throw new Error(data?.message ?? `quote: HTTP ${r.status}`);
  return {
    depositAddress: data.quote.depositAddress ?? "",
    amountOutFormatted: data.quote.amountOutFormatted,
    timeEstimate: data.quote.timeEstimate,
  };
}

export async function getStatus(depositAddress: string): Promise<{
  status: string;
  destTxHash?: string;
}> {
  const padded = "0x" + depositAddress.replace(/^0x/, "").padStart(64, "0");
  const r = await fetch(
    `${BASE}/v0/status?depositAddress=${encodeURIComponent(padded)}`,
    { headers: headers() },
  );
  if (!r.ok) throw new Error(`status: HTTP ${r.status}`);
  const d: any = await r.json();
  return {
    status: d.status,
    destTxHash: d.swapDetails?.destinationChainTxHashes?.[0]?.hash,
  };
}
