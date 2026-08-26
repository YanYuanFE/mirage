// AVNU private swap client — quotes + private-executor calldata for the
// in-pool conversion (STRK20 anonymizer flow). CORS is open, so the browser
// calls the API directly.

const BASE = "https://starknet.api.avnu.fi";

export type AvnuQuote = {
  quoteId: string;
  buyAmount: string; // hex, smallest unit
  sellAmount: string;
};

export async function avnuQuote(opts: {
  sellToken: string;
  buyToken: string;
  sellAmount: bigint;
}): Promise<AvnuQuote> {
  const q = new URLSearchParams({
    sellTokenAddress: opts.sellToken,
    buyTokenAddress: opts.buyToken,
    sellAmount: "0x" + opts.sellAmount.toString(16),
    size: "1",
  });
  const r = await fetch(`${BASE}/swap/v3/quotes?${q}`);
  if (!r.ok) throw new Error(`AVNU quotes: HTTP ${r.status}`);
  const quotes = await r.json();
  if (!quotes[0]) throw new Error("AVNU: no route for this pair");
  return quotes[0];
}

export type AvnuPrivateCalls = {
  calls: { contractAddress: string; entrypoint: string; calldata: string[] }[];
  executorAddress: string;
};

// `private: true` routes through AVNU's private-swap executor; the executor
// entrypoint expects [buyToken, ...serialized calls, openNoteId].
export async function avnuBuildPrivate(
  quoteId: string,
  slippage = 0.01,
): Promise<AvnuPrivateCalls> {
  const r = await fetch(`${BASE}/swap/v3/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quoteId, slippage, private: true }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.message ?? `AVNU build: HTTP ${r.status}`);
  if (!data.executorAddress)
    throw new Error("AVNU: missing executorAddress for private swap");
  return { calls: data.calls, executorAddress: data.executorAddress };
}
