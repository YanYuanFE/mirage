// 1Click reports destination tx hashes but leaves explorerUrl empty, so the
// link is built here. Chains without an entry still show the hash, unlinked.
const EXPLORERS: Record<string, string> = {
  eth: "https://etherscan.io/tx/",
  base: "https://basescan.org/tx/",
  arb: "https://arbiscan.io/tx/",
  op: "https://optimistic.etherscan.io/tx/",
  pol: "https://polygonscan.com/tx/",
  bsc: "https://bscscan.com/tx/",
  avax: "https://snowtrace.io/tx/",
  scroll: "https://scrollscan.com/tx/",
  bera: "https://berascan.com/tx/",
  gnosis: "https://gnosisscan.io/tx/",
  sol: "https://solscan.io/tx/",
  btc: "https://mempool.space/tx/",
  ltc: "https://blockchair.com/litecoin/transaction/",
  doge: "https://blockchair.com/dogecoin/transaction/",
  bch: "https://blockchair.com/bitcoin-cash/transaction/",
  zec: "https://blockchair.com/zcash/transaction/",
  xrp: "https://xrpscan.com/tx/",
  near: "https://nearblocks.io/txns/",
  ton: "https://tonviewer.com/transaction/",
  tron: "https://tronscan.org/#/transaction/",
  sui: "https://suivision.xyz/txblock/",
  aptos: "https://explorer.aptoslabs.com/txn/",
  stellar: "https://stellar.expert/explorer/public/tx/",
  cardano: "https://cardanoscan.io/transaction/",
  hypercore: "https://app.hyperliquid.xyz/explorer/tx/",
};

export function destExplorerTx(chain: string, hash: string): string | null {
  const base = EXPLORERS[chain];
  return base ? base + hash : null;
}
