// NEAR Intents 1Click API client. Calls go through the vite dev proxy (/1click)
// to avoid CORS; in production the workflow engine owns these calls server-side.

const BASE = "/1click";
const JWT = import.meta.env.VITE_ONECLICK_JWT as string | undefined;

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  ...(JWT ? { Authorization: `Bearer ${JWT}` } : {}),
};

export type OneClickToken = {
  assetId: string;
  blockchain: string;
  symbol: string;
  decimals: number;
  price: number;
  contractAddress?: string;
};

export const STARKNET_STRK_ASSET = "nep141:starknet.omft.near";

export async function fetchTokens(): Promise<OneClickToken[]> {
  const r = await fetch(`${BASE}/v0/tokens`, { headers });
  if (!r.ok) throw new Error(`tokens: HTTP ${r.status}`);
  return r.json();
}

export type Quote = {
  depositAddress: string;
  amountInFormatted: string;
  amountOut: string;
  amountOutFormatted: string;
  amountOutUsd: string;
  minAmountOut: string;
  timeEstimate: number;
  deadline: string;
};

// Outbound (pool → any chain): origin is always Starknet STRK; the amount is
// the token's smallest unit. Inbound uses requestQuoteRaw with an explicit origin.
export async function requestQuote(opts: {
  amountWei: bigint;
  destinationAsset: string;
  recipient: string;
  refundTo: string;
  dry?: boolean;
}): Promise<Quote> {
  return requestQuoteRaw({
    originAsset: STARKNET_STRK_ASSET,
    amount: opts.amountWei.toString(),
    destinationAsset: opts.destinationAsset,
    recipient: opts.recipient,
    refundTo: opts.refundTo,
    dry: opts.dry,
  });
}

// Full-control quote — used by the inbound (return) leg where the origin is a
// destination-chain asset and the recipient is the user's Starknet account.
export async function requestQuoteRaw(opts: {
  originAsset: string;
  destinationAsset: string;
  amount: string; // smallest unit of originAsset
  recipient: string;
  refundTo: string;
  dry?: boolean;
}): Promise<Quote> {
  const body = {
    dry: opts.dry ?? false,
    swapType: "EXACT_INPUT",
    slippageTolerance: 100,
    originAsset: opts.originAsset,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: opts.destinationAsset,
    amount: opts.amount,
    refundTo: opts.refundTo,
    refundType: "ORIGIN_CHAIN",
    recipient: opts.recipient,
    recipientType: "DESTINATION_CHAIN",
    deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
  const r = await fetch(`${BASE}/v0/quote`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.message ?? `quote: HTTP ${r.status}`);
  return { ...data.quote, depositAddress: data.quote.depositAddress };
}

export type SwapStatus = {
  status: string; // PENDING_DEPOSIT | PROCESSING | SUCCESS | REFUNDED | FAILED ...
  swapDetails?: {
    destinationChainTxHashes?: { hash: string; explorerUrl?: string }[];
    amountOutFormatted?: string;
  };
};

export async function getStatus(depositAddress: string): Promise<SwapStatus> {
  const r = await fetch(
    `${BASE}/v0/status?depositAddress=${encodeURIComponent(depositAddress)}`,
    { headers },
  );
  if (!r.ok) throw new Error(`status: HTTP ${r.status}`);
  return r.json();
}
