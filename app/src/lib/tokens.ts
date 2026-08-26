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

export const tokenBySymbol = (s: string) =>
  POOL_TOKENS.find((t) => t.symbol === s);

export const tokenByAddress = (a: string) =>
  POOL_TOKENS.find((t) => BigInt(t.address) === BigInt(a));

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
