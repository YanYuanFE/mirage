import { useEffect, useMemo, useState } from "react";
import { WalletAccountV6, num, validateAndParseAddress, walletV6 } from "starknet";
import type { WALLET_API } from "@starknet-io/types-js";
import { createStore } from "@starknet-io/get-starknet-discovery";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";
import {
  STRK,
  SN_MAIN,
  provider,
  explorerTx,
  fmtStrk,
  parseStrk,
  shortHex,
} from "./lib/config";
import {
  fetchTokens,
  requestQuote,
  getStatus,
  type OneClickToken,
  type Quote,
} from "./lib/oneclick";

type Tab = "shield" | "send" | "anywhere";

type Receipt = {
  status: "pending" | "ok" | "error";
  title: string;
  txHash?: string;
  note?: string;
};

export default function App() {
  // wallet
  const [wallets, setWallets] = useState<WalletWithStarknetFeatures[]>([]);
  const [wa, setWa] = useState<WalletAccountV6 | null>(null);
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  // balances
  const [publicBal, setPublicBal] = useState<bigint | null>(null);
  const [shieldedBal, setShieldedBal] = useState<bigint | null>(null);

  // ui
  const [tab, setTab] = useState<Tab>("shield");
  const [amount, setAmount] = useState("10");
  const [recipient, setRecipient] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  // cross-chain (anywhere)
  const [tokens, setTokens] = useState<OneClickToken[]>([]);
  const [destAsset, setDestAsset] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [swapPhase, setSwapPhase] = useState<string>("");

  useEffect(() => {
    const store = createStore({ eip1193Adapters: [] });
    setWallets(store.getWallets().slice());
    return store.subscribe((next) => setWallets(next.slice()));
  }, []);

  useEffect(() => {
    fetchTokens()
      .then((t) =>
        setTokens(
          t
            .filter((x) => x.blockchain !== "starknet")
            .sort((a, b) =>
              a.blockchain === b.blockchain
                ? a.symbol.localeCompare(b.symbol)
                : a.blockchain.localeCompare(b.blockchain),
            ),
        ),
      )
      .catch(() => setTokens([]));
  }, []);

  const onMainnet = chainId === SN_MAIN;

  async function connect(w: WalletWithStarknetFeatures) {
    const account = await WalletAccountV6.connect(provider, w);
    const accounts = await walletV6.requestAccounts(w);
    if (!Array.isArray(accounts)) throw new Error("Wallet not compatible");
    setWa(account);
    setAddress(validateAndParseAddress(accounts[0]));
    setChainId((await walletV6.requestChainId(w)) as string);
    setPickerOpen(false);
  }

  async function refreshBalances() {
    if (!address) return;
    try {
      const res = await provider.callContract({
        contractAddress: STRK,
        entrypoint: "balanceOf",
        calldata: [address],
      });
      setPublicBal(num.toBigInt(res[0]));
    } catch {
      setPublicBal(null);
    }
    try {
      const r: any = await wa?.strk20Balances([]);
      const arr = Array.isArray(r) ? r : (r?.value ?? []);
      const strk = arr.find(
        (b: any) =>
          num.toBigInt(b?.token ?? b?.token_address ?? b?.[0] ?? 0) ===
          num.toBigInt(STRK),
      );
      setShieldedBal(
        strk ? num.toBigInt(strk.amount ?? strk.balance ?? strk[1]) : 0n,
      );
    } catch {
      setShieldedBal(null);
    }
  }

  useEffect(() => {
    refreshBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, wa]);

  async function submit(actions: WALLET_API.STRK20_ACTION[], title: string) {
    if (!wa) return;
    setReceipt({ status: "pending", title: "Confirm in your wallet…" });
    let txHash: string;
    try {
      const r = await wa.strk20InvokeTransaction(actions);
      txHash = r.transaction_hash;
    } catch (e: any) {
      setReceipt({ status: "error", title: "Rejected", note: e?.message ?? String(e) });
      return undefined;
    }
    setReceipt({ status: "pending", title: `${title} — confirming…`, txHash });
    try {
      await provider.waitForTransaction(txHash, { retries: 400, retryInterval: 3000 });
      setReceipt({ status: "ok", title: `${title} confirmed`, txHash });
      refreshBalances();
      return txHash;
    } catch (e: any) {
      setReceipt({ status: "error", title: "Confirmation failed", txHash, note: e?.message });
      return undefined;
    }
  }

  const handleShield = () =>
    submit(
      [{ type: "deposit", token: STRK, amount: num.toHex(parseStrk(amount)) }],
      `Shield ${amount} STRK`,
    );

  const handleSend = () =>
    submit(
      [
        {
          type: "transfer",
          token: STRK,
          amount: num.toHex(parseStrk(amount)),
          recipient: validateAndParseAddress(recipient),
        },
      ],
      `Private send ${amount} STRK`,
    );

  // The Mirage core move: quote 1Click, then unshield straight to the one-time
  // deposit address. The pool's public leg only ever shows a fresh address.
  async function handleAnywhere() {
    if (!wa || !destAsset || !recipient) return;
    setQuote(null);
    setSwapPhase("");
    setReceipt({ status: "pending", title: "Requesting route…" });
    let q: Quote;
    try {
      q = await requestQuote({
        amountWei: parseStrk(amount),
        destinationAsset: destAsset,
        recipient: recipient.trim(),
        refundTo: address,
      });
    } catch (e: any) {
      setReceipt({ status: "error", title: "Quote failed", note: e?.message });
      return;
    }
    setQuote(q);
    const txHash = await submit(
      [
        {
          type: "withdraw",
          token: STRK,
          amount: num.toHex(parseStrk(amount)),
          recipient: q.depositAddress,
        },
      ],
      `Send ${amount} STRK cross-chain`,
    );
    if (!txHash) return;
    setSwapPhase("PROCESSING");
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const s = await getStatus(q.depositAddress);
        setSwapPhase(s.status);
        if (s.status === "SUCCESS" || s.status === "REFUNDED" || s.status === "FAILED")
          return;
      } catch {
        /* keep polling */
      }
    }
  }

  const destToken = useMemo(
    () => tokens.find((t) => t.assetId === destAsset),
    [tokens, destAsset],
  );

  return (
    <div className="shell">
      <header>
        <div className="brand">
          <span className="logo">◗</span> Mirage
        </div>
        {address ? (
          <button className="pill" onClick={() => { setWa(null); setAddress(""); }}>
            ● {shortHex(address)}
          </button>
        ) : (
          <button className="pill" onClick={() => setPickerOpen(true)}>
            Connect
          </button>
        )}
      </header>

      {address && !onMainnet && (
        <div className="warn">Switch your wallet to Starknet Mainnet.</div>
      )}

      <div className="balances">
        <div className="bal">
          <span>Public</span>
          <b>{publicBal !== null ? fmtStrk(publicBal) : "–"} STRK</b>
        </div>
        <div className="bal shieldedBal">
          <span>Shielded</span>
          <b>{shieldedBal !== null ? fmtStrk(shieldedBal) : "–"} STRK</b>
        </div>
      </div>

      <nav className="tabs">
        {(
          [
            ["shield", "Shield"],
            ["send", "Private send"],
            ["anywhere", "Send anywhere"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            className={tab === k ? "tab active" : "tab"}
            onClick={() => { setTab(k); setReceipt(null); setQuote(null); setSwapPhase(""); }}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="card">
        <label className="field">
          <span>Amount (STRK)</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>

        {tab === "send" && (
          <label className="field">
            <span>Recipient (Starknet, registered in pool)</span>
            <input
              placeholder="0x…"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </label>
        )}

        {tab === "anywhere" && (
          <>
            <label className="field">
              <span>Receive</span>
              <select value={destAsset} onChange={(e) => setDestAsset(e.target.value)}>
                <option value="">Select chain & asset…</option>
                {tokens.map((t) => (
                  <option key={t.assetId} value={t.assetId}>
                    {t.symbol} on {t.blockchain}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Recipient address {destToken ? `(${destToken.blockchain})` : ""}</span>
              <input
                placeholder="address on the destination chain"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </label>
          </>
        )}

        {!address ? (
          <button className="cta" onClick={() => setPickerOpen(true)}>
            Connect a wallet
          </button>
        ) : (
          <button
            className="cta"
            disabled={!onMainnet || (tab !== "shield" && !recipient) || (tab === "anywhere" && !destAsset)}
            onClick={tab === "shield" ? handleShield : tab === "send" ? handleSend : handleAnywhere}
          >
            {tab === "shield" ? "Shield" : tab === "send" ? "Send privately" : "Send anywhere"}
          </button>
        )}

        {quote && (
          <div className="quoteBox">
            <div>
              → {quote.amountOutFormatted} {destToken?.symbol} on {destToken?.blockchain}
              {" "}(~{quote.timeEstimate}s)
            </div>
            <div className="mono">via one-time deposit {shortHex(quote.depositAddress)}</div>
            {swapPhase && <div className="phase">{swapPhase}</div>}
          </div>
        )}

        {receipt && (
          <div className={`receipt ${receipt.status}`}>
            <b>{receipt.status === "ok" ? "✓ " : receipt.status === "error" ? "✕ " : "⋯ "}
              {receipt.title}</b>
            {receipt.txHash && (
              <a href={explorerTx(receipt.txHash)} target="_blank" rel="noreferrer">
                {shortHex(receipt.txHash)} ↗
              </a>
            )}
            {receipt.note && <pre>{receipt.note}</pre>}
          </div>
        )}
      </main>

      <footer>
        Shield on Starknet · exit anywhere · no on-chain link.{" "}
        <a href="https://github.com/YanYuanFE/mirage" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>

      {pickerOpen && (
        <div className="overlay" onClick={() => setPickerOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Connect a wallet</h3>
            {wallets.length ? (
              wallets
                .filter((w) => !/metamask/i.test(w.name))
                .map((w) => (
                  <button key={w.name} className="walletRow" onClick={() => connect(w)}>
                    <img src={w.icon} alt="" width={24} height={24} /> {w.name}
                  </button>
                ))
            ) : (
              <p>
                No Starknet wallet found. Install{" "}
                <a href="https://www.ready.co/" target="_blank" rel="noreferrer">Ready</a>.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
