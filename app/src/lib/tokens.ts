// Curated Starknet mainnet ERC-20s the app can shield. The pool itself
// accepts any ERC-20 — this list is just the UI picker.
export type PoolToken = {
  symbol: string;
  address: string;
  decimals: number;
};

export const POOL_TOKENS: PoolToken[] = [
  {
    symbol: "STRK",
    address: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    decimals: 18,
  },
  {
    symbol: "ETH",
    address: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
    decimals: 18,
  },
  {
    symbol: "USDC",
    address: "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
    decimals: 6,
  },
  {
    symbol: "USDT",
    address: "0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8",
    decimals: 6,
  },
  {
    symbol: "WBTC",
    address: "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac",
    decimals: 8,
  },
];

// Sentinel for the "paste any ERC-20" option — the pool takes any token, this
// list is only a shortcut for the common ones.
export const CUSTOM_TOKEN = "__custom__";

export const tokenBySymbol = (s: string) =>
  POOL_TOKENS.find((t) => t.symbol === s);

export const tokenByAddress = (a: string) =>
  POOL_TOKENS.find((t) => BigInt(t.address) === BigInt(a));

// Reads an arbitrary ERC-20's symbol and decimals straight off the chain.
// `symbol()` is a felt short string on older tokens and a ByteArray on newer
// ones; both shapes are handled, and the address stands in if neither decodes.
export async function readToken(
  address: string,
  call: (req: {
    contractAddress: string;
    entrypoint: string;
    calldata: string[];
  }) => Promise<string[]>,
  decodeShortString: (v: string) => string,
): Promise<PoolToken> {
  const dec = await call({ contractAddress: address, entrypoint: "decimals", calldata: [] });
  const decimals = Number(BigInt(dec[0]));
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 30)
    throw new Error("not an ERC-20 (bad decimals)");

  let symbol = `${address.slice(0, 6)}…${address.slice(-4)}`;
  try {
    const s = await call({ contractAddress: address, entrypoint: "symbol", calldata: [] });
    if (s.length === 1) symbol = decodeShortString(s[0]);
    else if (s.length >= 3 && BigInt(s[0]) === 0n) symbol = decodeShortString(s[1]);
  } catch {
    /* keep the address label */
  }
  return { symbol, address, decimals };
}

export function fmtUnits(amount: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const frac = (amount % base)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "")
    .slice(0, 6);
  return frac ? `${whole}.${frac}` : `${whole}`;
}
