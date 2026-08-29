import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Split,
  Globe,
  ArrowRight,
  Sun,
  Moon,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkIcon } from "@/components/MarkIcon";
import { ChainIcon } from "@/components/ChainIcon";
import type { Theme } from "@/lib/theme";

// [1Click chain code, display name] — the code drives the icon.
const CHAINS: [string, string][] = [
  ["btc", "Bitcoin"], ["eth", "Ethereum"], ["sol", "Solana"], ["base", "Base"],
  ["arb", "Arbitrum"], ["ton", "TON"], ["tron", "Tron"], ["aptos", "Aptos"],
  ["sui", "Sui"], ["pol", "Polygon"], ["op", "Optimism"], ["avax", "Avalanche"],
  ["bsc", "BNB Chain"], ["stellar", "Stellar"], ["near", "NEAR"], ["zec", "Zcash"],
  ["ltc", "Litecoin"], ["doge", "Dogecoin"], ["bera", "Berachain"], ["monad", "Monad"],
  ["scroll", "Scroll"], ["hypercore", "Hyperliquid"], ["cardano", "Cardano"], ["xrp", "XRP"],
];

const STEPS = [
  {
    icon: ShieldCheck,
    n: "01",
    title: "Shield",
    body: "Deposit any token into the STRK20 privacy pool on Starknet. It becomes an encrypted note — the only move your main wallet ever signs.",
  },
  {
    icon: Split,
    n: "02",
    title: "Split",
    body: "The workflow engine breaks your transfer into chunks with randomized sizes and timing, each routed through its own one-time address.",
  },
  {
    icon: Globe,
    n: "03",
    title: "Deliver",
    body: "NEAR Intents solvers settle each chunk on the destination chain — Bitcoin, Solana, Base — to a fresh address, in seconds.",
  },
];

const HIDDEN = [
  { hidden: true, label: "The link between your wallet and the funds leaving the pool" },
  { hidden: true, label: "Which deposit a given withdrawal came from" },
  { hidden: true, label: "Any path from the destination chain back to Starknet" },
  { hidden: false, label: "That an address interacted with a privacy pool, and when" },
  { hidden: false, label: "The amounts on the public deposit and withdrawal legs" },
];

export default function Landing({
  theme,
  onToggleTheme,
}: {
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const navigate = useNavigate();
  const onLaunch = () => navigate("/app");
  return (
    <div className="relative z-10">
      {/* Nav */}
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <MarkIcon size={30} id="mark-nav" />
          <span className="font-serif text-xl font-medium tracking-tight">Mirage</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-3">
          <button
            onClick={() => navigate("/docs")}
            className="hidden text-sm text-muted-foreground transition hover:text-foreground sm:block"
          >
            Docs
          </button>
          <a
            href="https://github.com/YanYuanFE/mirage"
            target="_blank"
            rel="noreferrer"
            className="hidden text-sm text-muted-foreground transition hover:text-foreground sm:block"
          >
            GitHub
          </a>
          <Button variant="ghost" size="icon" onClick={onToggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button size="sm" onClick={onLaunch} className="gap-1.5">
            Launch app <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <header className="mx-auto max-w-5xl px-6 pb-20 pt-16 sm:pt-24">
        <div
          className="rise mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur"
          style={{ animationDelay: "0ms" }}
        >
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Live on Starknet mainnet · STRK20 Private Sprint
        </div>

        <h1
          className="rise max-w-3xl font-serif text-5xl font-medium leading-[1.02] tracking-tight sm:text-7xl"
          style={{ animationDelay: "80ms" }}
        >
          Shield once,
          <br />
          act anywhere,
          <br />
          <span className="shimmer">leave no trace.</span>
        </h1>

        <p
          className="rise mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground"
          style={{ animationDelay: "180ms" }}
        >
          Shield any token on Starknet, then send it anywhere — Bitcoin, Base,
          Solana — with no on-chain link between you and where it lands. A privacy
          layer for the whole multichain economy, behind a wallet you already have.
        </p>

        <div
          className="rise mt-9 flex flex-wrap items-center gap-3"
          style={{ animationDelay: "280ms" }}
        >
          <Button size="lg" onClick={onLaunch} className="gap-2">
            Launch app <ArrowRight className="size-4" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/docs")}>
            Read the architecture
          </Button>
        </div>

        {/* Stat strip */}
        <div
          className="rise mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4"
          style={{ animationDelay: "380ms" }}
        >
          {[
            ["35+", "chains"],
            ["186", "assets"],
            ["~27s", "to settle"],
            ["0", "on-chain links"],
          ].map(([v, l]) => (
            <div key={l} className="flex flex-col gap-1 bg-card px-5 py-6">
              <span className="font-serif text-3xl font-medium">{v}</span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{l}</span>
            </div>
          ))}
        </div>
      </header>

      {/* Flow */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-primary">
          How it works
        </p>
        <h2 className="mb-12 max-w-lg font-serif text-3xl font-medium tracking-tight sm:text-4xl">
          Three moves between you and anywhere.
        </h2>

        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className="group relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 transition hover:border-primary/40"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="size-5" />
                </span>
                <span className="font-mono text-sm text-muted-foreground">{s.n}</span>
              </div>
              <h3 className="font-serif text-2xl font-medium">{s.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              {i < STEPS.length - 1 && (
                <ArrowRight className="absolute -right-3 top-1/2 hidden size-5 -translate-y-1/2 text-border md:block" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* What's hidden — honesty */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-widest text-primary">
              The honest claim
            </p>
            <h2 className="font-serif text-3xl font-medium tracking-tight sm:text-4xl">
              What a mirage hides — and what it doesn't.
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              Overclaiming is how privacy tools mislead the people who need them most.
              Mirage claims exactly one thing: the two sides are not linkable on-chain.
              It doesn't hide that you used a pool, or the amounts at the edges — which
              is why splitting and timing jitter exist.
            </p>
          </div>

          <ul className="flex flex-col gap-2.5">
            {HIDDEN.map((h) => (
              <li
                key={h.label}
                className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <span
                  className={
                    "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md " +
                    (h.hidden ? "bg-primary/12 text-primary" : "bg-warm/15 text-warm")
                  }
                >
                  {h.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </span>
                <span className="text-sm leading-snug">
                  <span
                    className={
                      "mr-1.5 text-xs font-medium uppercase tracking-wide " +
                      (h.hidden ? "text-primary" : "text-warm")
                    }
                  >
                    {h.hidden ? "Hidden" : "Public"}
                  </span>
                  {h.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Chains marquee */}
      <section className="py-10">
        <p className="mb-5 text-center text-xs uppercase tracking-widest text-muted-foreground">
          Exit to any of 35+ chains
        </p>
        <div className="marquee-mask flex flex-col gap-3 overflow-hidden">
          {[CHAINS.slice(0, 12), CHAINS.slice(12)].map((row, rowIndex) => (
            <div
              key={rowIndex}
              className={"marquee-track gap-3" + (rowIndex ? " reverse" : "")}
            >
              {[0, 1].map((pass) =>
                row.map(([code, name]) => (
                  <span
                    key={`${pass}-${code}`}
                    aria-hidden={pass === 1}
                    className="flex shrink-0 items-center gap-2.5 rounded-full border border-border bg-card px-5 py-2.5 text-base text-muted-foreground"
                  >
                    <ChainIcon chain={code} size={6} />
                    {name}
                  </span>
                )),
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-8 py-16 text-center">
          <span className="pointer-events-none absolute -left-10 -top-10 size-40 rounded-full bg-warm/15 blur-3xl" />
          <span className="pointer-events-none absolute -bottom-10 -right-10 size-40 rounded-full bg-primary/20 blur-3xl" />
          <h2 className="relative font-serif text-4xl font-medium tracking-tight sm:text-5xl">
            Seen everywhere.
            <br />
            <span className="shimmer">Found nowhere.</span>
          </h2>
          <p className="relative mx-auto mt-5 max-w-md text-muted-foreground">
            Connect a Starknet wallet and move your first value privately across chains.
          </p>
          <div className="relative mt-8">
            <Button size="lg" onClick={onLaunch} className="gap-2">
              Launch Mirage <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-5xl px-6 pb-12 pt-4">
        <div className="flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-sm text-muted-foreground sm:flex-row">
          <span className="flex items-center gap-2">
            <MarkIcon size={18} id="mark-foot" /> Mirage · STRK20 Private Sprint 2026
          </span>
          <div className="flex gap-5">
            <a
              href="https://github.com/YanYuanFE/mirage"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-foreground"
            >
              GitHub
            </a>
            <a
              href="https://strk20.starknet.io"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-foreground"
            >
              STRK20
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
