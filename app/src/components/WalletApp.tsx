import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WalletAccountV6, num, validateAndParseAddress, walletV6 } from "starknet";
import type { WALLET_API } from "@starknet-io/types-js";
import { createStore } from "@starknet-io/get-starknet-discovery";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Loader2,
  ShieldCheck,
  Send,
  Globe,
  Wallet,
  Copy,
  Check,
  Sun,
  Moon,
  ArrowLeft,
} from "lucide-react";
import {
  STRK,
  SN_MAIN,
  provider,
  explorerTx,
  fmtStrk,
  parseStrk,
  shortHex,
} from "@/lib/config";
import { fetchTokens, requestQuote, type OneClickToken } from "@/lib/oneclick";
import { buildPlan, executePlan, loadPlan, savePlan, type Plan } from "@/lib/engine";
import { MarkIcon } from "@/components/MarkIcon";
import type { Theme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Tab = "shield" | "send" | "anywhere";

export default function WalletApp({
  theme,
  onToggleTheme,
}: {
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const navigate = useNavigate();
  const onHome = () => navigate("/");
  const [wallets, setWallets] = useState<WalletWithStarknetFeatures[]>([]);
  const [wa, setWa] = useState<WalletAccountV6 | null>(null);
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [publicBal, setPublicBal] = useState<bigint | null>(null);
  const [shieldedBal, setShieldedBal] = useState<bigint | null>(null);

  const [tab, setTab] = useState<Tab>("shield");
  const [amount, setAmount] = useState("10");
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);

  const [tokens, setTokens] = useState<OneClickToken[]>([]);
  const [destAsset, setDestAsset] = useState("");

  const [chunkCount, setChunkCount] = useState(3);
  const [plan, setPlan] = useState<Plan | null>(() => loadPlan());
  const [running, setRunning] = useState(false);

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
  const destToken = useMemo(
    () => tokens.find((t) => t.assetId === destAsset),
    [tokens, destAsset],
  );

  async function connect(w: WalletWithStarknetFeatures) {
    try {
      const account = await WalletAccountV6.connect(provider, w);
      const accounts = await walletV6.requestAccounts(w);
      if (!Array.isArray(accounts)) throw new Error("Wallet not compatible");
      setWa(account);
      setAddress(validateAndParseAddress(accounts[0]));
      setChainId((await walletV6.requestChainId(w)) as string);
      setPickerOpen(false);
      toast.success(`Connected ${w.name}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Connection failed");
    }
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
      setShieldedBal(strk ? num.toBigInt(strk.amount ?? strk.balance ?? strk[1]) : 0n);
    } catch {
      setShieldedBal(null);
    }
  }

  useEffect(() => {
    refreshBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, wa]);

  async function submit(actions: WALLET_API.STRK20_ACTION[], title: string) {
    if (!wa) return undefined;
    setBusy(true);
    const id = toast.loading("Confirm in your wallet…");
    let txHash: string;
    try {
      const r = await wa.strk20InvokeTransaction(actions);
      txHash = r.transaction_hash;
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      toast.error(
        /NOT_REGISTERED/.test(msg)
          ? "Account not registered — register once at strk20.starknet.io/app, then retry."
          : `Rejected: ${msg}`,
        { id },
      );
      setBusy(false);
      return undefined;
    }
    toast.loading(`${title} — confirming on-chain…`, { id });
    try {
      await provider.waitForTransaction(txHash, { retries: 400, retryInterval: 3000 });
      toast.success(`${title} confirmed`, {
        id,
        action: { label: "View", onClick: () => window.open(explorerTx(txHash), "_blank") },
      });
      refreshBalances();
      return txHash;
    } catch (e: any) {
      toast.error(`Confirmation failed: ${e?.message ?? e}`, { id });
      return undefined;
    } finally {
      setBusy(false);
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

  async function withdrawTo(amountWei: bigint, depositAddress: string): Promise<string> {
    if (!wa) throw new Error("no wallet");
    const r = await wa.strk20InvokeTransaction([
      { type: "withdraw", token: STRK, amount: num.toHex(amountWei), recipient: depositAddress },
    ]);
    await provider.waitForTransaction(r.transaction_hash, { retries: 400, retryInterval: 3000 });
    refreshBalances();
    return r.transaction_hash;
  }

  async function handleAnywhere() {
    if (!wa || !destAsset || !recipient) return;

    if (chunkCount > 1) {
      const p = buildPlan({
        totalWei: parseStrk(amount),
        destAsset,
        destLabel: destToken ? `${destToken.symbol} on ${destToken.blockchain}` : destAsset,
        recipient: recipient.trim(),
        refundTo: address,
        chunkCount,
      });
      savePlan(p);
      setPlan(p);
      setRunning(true);
      toast.info(`Executing ${chunkCount}-chunk private plan…`);
      try {
        const done = await executePlan(p, withdrawTo, setPlan);
        done.chunks.every((c) => c.status === "success")
          ? toast.success("Plan complete — all chunks delivered")
          : toast.warning("Plan stopped — resume from the plan panel");
      } finally {
        setRunning(false);
      }
      return;
    }

    setBusy(true);
    const id = toast.loading("Requesting route…");
    try {
      const q = await requestQuote({
        amountWei: parseStrk(amount),
        destinationAsset: destAsset,
        recipient: recipient.trim(),
        refundTo: address,
      });
      toast.loading(
        `Route: ${q.amountOutFormatted} ${destToken?.symbol} · ~${q.timeEstimate}s. Confirm in wallet…`,
        { id },
      );
      const txHash = await withdrawTo(parseStrk(amount), q.depositAddress);
      toast.success(`Sent — ${q.amountOutFormatted} ${destToken?.symbol} en route`, {
        id,
        action: { label: "View", onClick: () => window.open(explorerTx(txHash), "_blank") },
      });
    } catch (e: any) {
      toast.error(e?.message ?? String(e), { id });
    } finally {
      setBusy(false);
    }
  }

  async function resumePlan() {
    if (!plan || !wa) return;
    setRunning(true);
    try {
      await executePlan(plan, withdrawTo, setPlan);
    } finally {
      setRunning(false);
    }
  }

  function copyAddr() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Address copied");
    setTimeout(() => setCopied(false), 1500);
  }

  const ctaDisabled =
    busy ||
    running ||
    !onMainnet ||
    (tab !== "shield" && !recipient) ||
    (tab === "anywhere" && !destAsset);

  return (
    <div className="relative z-10 mx-auto flex max-w-md flex-col gap-5 px-4 py-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <button
          onClick={onHome}
          className="group flex items-center gap-2.5 text-left"
          aria-label="Home"
        >
          <MarkIcon size={30} id="mark-app" className="transition group-hover:scale-105" />
          <span className="font-serif text-xl font-medium tracking-tight">Mirage</span>
        </button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onToggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          {address ? (
            <Button variant="secondary" size="sm" className="gap-2 font-mono" onClick={copyAddr}>
              <span className="size-1.5 rounded-full bg-emerald-400" />
              {shortHex(address)}
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </Button>
          ) : (
            <Button size="sm" className="gap-2" onClick={() => setPickerOpen(true)}>
              <Wallet className="size-4" /> Connect
            </Button>
          )}
        </div>
      </header>

      {address && !onMainnet && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardContent className="py-3 text-sm text-amber-500 dark:text-amber-300">
            Switch your wallet to Starknet Mainnet.
          </CardContent>
        </Card>
      )}

      {/* Balances */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="overflow-hidden">
          <CardContent className="relative flex flex-col gap-1 py-4">
            <span className="absolute -right-6 -top-6 size-16 rounded-full bg-warm/15 blur-xl" />
            <span className="text-xs text-muted-foreground">Public</span>
            <span className="font-mono text-lg font-semibold">
              {publicBal !== null ? fmtStrk(publicBal) : "–"}{" "}
              <span className="text-sm text-muted-foreground">STRK</span>
            </span>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-primary/40">
          <CardContent className="relative flex flex-col gap-1 py-4">
            <span className="absolute -right-6 -top-6 size-16 rounded-full bg-primary/20 blur-xl" />
            <span className="flex items-center gap-1 text-xs text-primary">
              <ShieldCheck className="size-3.5" /> Shielded
            </span>
            <span className="font-mono text-lg font-semibold">
              {shieldedBal !== null ? fmtStrk(shieldedBal) : "–"}{" "}
              <span className="text-sm text-muted-foreground">STRK</span>
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="shield" className="gap-1.5">
            <ShieldCheck className="size-4" /> Shield
          </TabsTrigger>
          <TabsTrigger value="send" className="gap-1.5">
            <Send className="size-4" /> Send
          </TabsTrigger>
          <TabsTrigger value="anywhere" className="gap-1.5">
            <Globe className="size-4" /> Anywhere
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Action card */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amount">Amount (STRK)</Label>
            <Input
              id="amount"
              value={amount}
              inputMode="decimal"
              className="font-mono"
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {tab === "send" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="recipient">Recipient (Starknet, registered in pool)</Label>
              <Input
                id="recipient"
                placeholder="0x…"
                className="font-mono"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>
          )}

          {tab === "anywhere" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>Receive</Label>
                <Select value={destAsset} onValueChange={(v) => setDestAsset(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select chain & asset…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {tokens.map((t) => (
                      <SelectItem key={t.assetId} value={t.assetId}>
                        {t.symbol}{" "}
                        <span className="text-muted-foreground">on {t.blockchain}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dest">
                  Recipient address {destToken ? `(${destToken.blockchain})` : ""}
                </Label>
                <Input
                  id="dest"
                  placeholder="address on the destination chain"
                  className="font-mono"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Privacy split — randomized size &amp; timing</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <Button
                      key={n}
                      type="button"
                      variant={chunkCount === n ? "default" : "outline"}
                      size="sm"
                      onClick={() => setChunkCount(n)}
                    >
                      {n === 1 ? "off" : n}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          {!address ? (
            <Button size="lg" className="mt-1 w-full gap-2" onClick={() => setPickerOpen(true)}>
              <Wallet className="size-4" /> Connect a wallet
            </Button>
          ) : (
            <Button
              size="lg"
              className="mt-1 w-full"
              disabled={ctaDisabled}
              onClick={
                tab === "shield" ? handleShield : tab === "send" ? handleSend : handleAnywhere
              }
            >
              {(busy || running) && <Loader2 className="size-4 animate-spin" />}
              {tab === "shield"
                ? "Shield"
                : tab === "send"
                  ? "Send privately"
                  : running
                    ? "Executing plan…"
                    : chunkCount > 1
                      ? `Send in ${chunkCount} chunks`
                      : "Send anywhere"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Plan panel */}
      {tab === "anywhere" && plan && (
        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Plan · {fmtStrk(BigInt(plan.totalWei))} STRK → {plan.destLabel}
              </span>
              {!running && (
                <div className="flex gap-1.5">
                  {plan.chunks.some((c) => c.status !== "success") && (
                    <Button variant="ghost" size="sm" onClick={resumePlan}>
                      Resume
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      savePlan(null);
                      setPlan(null);
                    }}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
            <Separator />
            <div className="flex flex-col gap-2">
              {plan.chunks.map((c, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span
                    className={
                      "size-2 rounded-full " +
                      (c.status === "success"
                        ? "bg-emerald-400"
                        : c.status === "failed"
                          ? "bg-destructive"
                          : c.status === "scheduled"
                            ? "bg-muted-foreground"
                            : "bg-primary animate-pulse")
                    }
                  />
                  <span className="w-24 font-mono font-medium">
                    {fmtStrk(BigInt(c.amountWei))} STRK
                  </span>
                  <span className="flex-1 text-muted-foreground">
                    {c.status === "scheduled" && `waits ${Math.round(c.delayMs / 1000)}s`}
                    {c.status === "quoting" && "quoting…"}
                    {c.status === "awaiting_wallet" && "confirm in wallet…"}
                    {c.status === "bridging" && "bridging…"}
                    {c.status === "success" && `✓ ${c.amountOutFormatted ?? ""}`}
                    {c.status === "failed" && `✕ ${c.error ?? "failed"}`}
                  </span>
                  {c.txHash && (
                    <a
                      href={explorerTx(c.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary"
                    >
                      <ArrowUpRight className="size-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <button
        onClick={onHome}
        className="mx-auto flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-3" /> Back to overview
      </button>

      {/* Wallet picker */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Connect a wallet</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {wallets.filter((w) => !/metamask/i.test(w.name)).length ? (
              wallets
                .filter((w) => !/metamask/i.test(w.name))
                .map((w) => (
                  <Button
                    key={w.name}
                    variant="outline"
                    className="justify-start gap-3"
                    onClick={() => connect(w)}
                  >
                    <img src={w.icon} alt="" className="size-6 rounded" />
                    {w.name}
                  </Button>
                ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No Starknet wallet found. Install{" "}
                <a
                  href="https://www.ready.co/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-4"
                >
                  Ready
                </a>
                .
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
