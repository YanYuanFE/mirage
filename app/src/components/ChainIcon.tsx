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

export function ChainIcon({ chain }: { chain: string }) {
  const [failed, setFailed] = useState(false);
  const name = LLAMAO[chain];
  if (!name || failed)
    return (
      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold uppercase text-muted-foreground">
        {chain[0]}
      </span>
    );
  return (
    <img
      src={`https://icons.llamao.fi/icons/chains/rsz_${encodeURIComponent(name)}.jpg`}
      alt=""
      className="size-4 shrink-0 rounded-full"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
