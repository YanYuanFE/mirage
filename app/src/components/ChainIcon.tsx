import { useState } from "react";

// 1Click chain code → DefiLlama icon name (icons.llamao.fi). Codes without an
// icon there (starknet, dash) fall back to a letter badge.
const LLAMAO: Record<string, string> = {
  abs: "abstract",
  adi: "adi",
  aleo: "aleo",
  aptos: "aptos",
  arb: "arbitrum",
  avax: "avalanche",
  base: "base",
  bch: "bitcoincash",
  bera: "berachain",
  bsc: "binance",
  btc: "bitcoin",
  cardano: "cardano",
  doge: "doge",
  eth: "ethereum",
  fogo: "fogo",
  gnosis: "gnosis",
  hypercore: "hyperliquid",
  ltc: "litecoin",
  monad: "monad",
  movement: "movement",
  near: "near",
  op: "optimism",
  plasma: "plasma",
  pol: "polygon",
  scroll: "scroll",
  sol: "solana",
  stellar: "stellar",
  sui: "sui",
  ton: "ton",
  tron: "tron",
  xlayer: "x layer",
  xrp: "xrpl",
  zec: "zcash",
};

// Tailwind needs whole class names, so sizes are looked up rather than built.
const SIZE = {
  4: ["size-4", "text-[9px]"],
  6: ["size-6", "text-[11px]"],
} as const;

export function ChainIcon({ chain, size = 4 }: { chain: string; size?: keyof typeof SIZE }) {
  const [failed, setFailed] = useState(false);
  const [box, label] = SIZE[size];
  const name = LLAMAO[chain];
  if (!name || failed)
    return (
      <span
        className={`flex ${box} ${label} shrink-0 items-center justify-center rounded-full bg-muted font-semibold uppercase text-muted-foreground`}
      >
        {chain[0]}
      </span>
    );
  return (
    <img
      src={`https://icons.llamao.fi/icons/chains/rsz_${encodeURIComponent(name)}.jpg`}
      alt=""
      className={`${box} shrink-0 rounded-full`}
      onError={() => setFailed(true)}
    />
  );
}
