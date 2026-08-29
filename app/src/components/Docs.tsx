import { useNavigate } from "react-router-dom";
import { ArrowRight, Moon, Sun, ArrowLeft, Check, X } from "lucide-react";
import { MarkIcon } from "@/components/MarkIcon";
import { Button } from "@/components/ui/button";
import type { Theme } from "@/lib/theme";

const SECTIONS = [
  ["primitives", "Primitives"],
  ["flow", "End-to-end flow"],
  ["strk20", "STRK20 integration"],
  ["intents", "Cross-chain execution"],
  ["engine", "Workflow engine"],
  ["limits", "What we don't hide"],
  ["priorart", "Prior art"],
  ["status", "Shipped vs planned"],
] as const;

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border py-14 first:border-t-0">
      <p className="mb-2 text-sm font-medium uppercase tracking-widest text-primary">{eyebrow}</p>
      <h2 className="mb-6 font-serif text-3xl font-medium tracking-tight">{title}</h2>
      <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-border bg-card p-5 font-mono text-xs leading-relaxed text-foreground/80">
      {children}
    </pre>
  );
}

const ACTIONS = [
  ["deposit", "Shield any ERC-20 into the pool. A public transaction — no proof needed."],
  ["transfer", "Note-to-note payment inside the pool. Emits an encrypted note and a nullifier: no amount, no parties."],
  ["withdraw", "Leave the pool to a public address. The ZK proof is what breaks the link to the depositor."],
  ["invoke", "Call an anonymizer from inside the private transaction — how the in-pool swap runs."],
];

const LIMITS = [
  [true, "The link between your wallet and the destination address"],
  [true, "Which shielded note funded a given exit"],
  [true, "Counterparties of an in-pool private transfer"],
  [false, "That you used the pool at all — shielding is a public transaction"],
  [false, "Amounts at the edges; correlation is why splitting and jitter exist"],
  [false, "A refunded exit — the refund lands on your own account today"],
];

export default function Docs({
  theme,
  onToggleTheme,
}: {
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="relative z-10">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <button
          className="flex items-center gap-2.5"
          onClick={() => navigate("/")}
          aria-label="Home"
        >
          <MarkIcon size={30} id="mark-docs" />
          <span className="font-serif text-xl font-medium tracking-tight">Mirage</span>
        </button>
        <div className="flex items-center gap-1 sm:gap-3">
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
          <Button size="sm" onClick={() => navigate("/app")} className="gap-1.5">
            Launch app <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 pb-24">
        <header className="py-10">
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-primary">
            Architecture
          </p>
          <h1 className="max-w-2xl font-serif text-4xl font-medium leading-tight tracking-tight sm:text-5xl">
            How Mirage turns a shielded pool into an exit to anywhere.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Three live primitives, one flow, and an explicit account of what stays
            visible. Everything described here runs on Starknet mainnet — there is no
            testnet for this stack, so every transaction is real.
          </p>
        </header>

        <div className="gap-12 md:grid md:grid-cols-[180px_1fr]">
          <aside className="hidden md:block">
            <nav className="sticky top-8 flex flex-col gap-2 border-l border-border pl-4">
              {SECTIONS.map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="text-sm text-muted-foreground transition hover:text-foreground"
                >
                  {label}
                </a>
              ))}
            </nav>
          </aside>

          <main>
            <Section id="primitives" eyebrow="Building blocks" title="Three primitives, all live">
              <p>
                Mirage is not a key-managing wallet. Users keep ArgentX or Ready; Mirage
                composes three things on top of the wallet they already have.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  [
                    "STRK20 pool",
                    "Shield any ERC-20 on Starknet. The ZK proof breaks the link between depositor and exit.",
                  ],
                  [
                    "NEAR Intents",
                    "Intent-based settlement to 35 chains. Every transfer gets a one-time deposit address — no fixed bridge to trace.",
                  ],
                  [
                    "Workflow engine",
                    "Executes a transfer as a plan: randomized chunk sizes, jittered timing, resumable.",
                  ],
                ].map(([t, b]) => (
                  <div key={t} className="rounded-xl border border-border bg-card p-5">
                    <h3 className="mb-2 font-serif text-lg font-medium text-foreground">{t}</h3>
                    <p className="text-xs leading-relaxed">{b}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="flow" eyebrow="The path" title="From your wallet to any chain">
              <Code>{`main wallet ──shield──▶ STRK20 pool          only tx your wallet signs
                          │
                          │ in-pool swap → STRK   (AVNU anonymizer, privacy_invoke)
                          ▼
                   withdraw ──▶ 1Click one-time deposit address
                          │
                          │ NEAR Intents solvers fill the intent
                          ▼
              186 assets on 35 chains, at a fresh address`}</Code>
              <p>
                The return leg runs the same rail backwards: fund a one-time address on
                any chain, solvers deliver STRK to your Starknet account, and shielding
                it closes the round trip. In the app both directions live under one{" "}
                <strong className="text-foreground">Swap</strong> tab.
              </p>
              <p>
                <strong className="text-foreground">Why the swap to STRK:</strong> 1Click
                accepts only STRK (plus wrapped ZEC and XRP) leaving Starknet. Anything
                else converts inside the pool first, and the exit runs on the STRK that
                conversion actually credited — measured from the balance, not the quote,
                because slippage makes the quote an estimate.
              </p>
            </Section>

            <Section id="strk20" eyebrow="Integration depth" title="How Mirage uses STRK20">
              <p>
                Mirage runs on the{" "}
                <strong className="text-foreground">Wallet API route</strong>: the wallet
                holds the viewing key and produces the proof, so the app never sees a key
                and needs no proving service of its own. That requires the Wallet API v6
                methods, which today means starknet.js v10 and a privacy-enabled wallet.
              </p>
              <div className="overflow-hidden rounded-xl border border-border">
                {ACTIONS.map(([a, d], i) => (
                  <div
                    key={a}
                    className={
                      "flex flex-col gap-1 bg-card px-5 py-4 sm:flex-row sm:gap-5" +
                      (i ? " border-t border-border" : "")
                    }
                  >
                    <code className="shrink-0 font-mono text-xs text-primary sm:w-24">{a}</code>
                    <span className="text-xs leading-relaxed">{d}</span>
                  </div>
                ))}
              </div>
              <p>
                The in-pool swap is the deepest piece. It composes all three note
                primitives into a single atomic transaction the wallet proves itself —
                a withdrawal that pays AVNU's private executor, an open note to receive
                the result, and an <code className="font-mono text-xs">invoke</code> whose
                calldata carries the open note's id:
              </p>
              <Code>{`[
  { type: "withdraw", token: USDC, amount, recipient: avnuExecutor },
  { type: "transfer", token: STRK, amount: "OPEN", recipient: self },
  { type: "invoke",   contract: avnuExecutor,
    calldata: [STRK, ...serializedSwapCalls, "\${openNoteIds[0]}"] },
]`}</Code>
              <p>
                Shielding is the only action that needs no proof — it is an ordinary
                public transaction. Spending a note is what requires one.
              </p>
            </Section>

            <Section id="intents" eyebrow="Cross-chain" title="Settlement through NEAR Intents">
              <p>
                Mirage quotes 1Click with Starknet STRK as origin and the user's chosen
                asset, chain, and address as destination. Solvers fill the intent; the
                app polls until settlement. Because each transfer gets its own one-time
                deposit address, there is no shared bridge contract linking transfers to
                each other.
              </p>
              <p>
                No testnet exists for this API, so every integration test was a
                small-amount mainnet transfer — which is also what satisfies the sprint's
                mainnet requirement.
              </p>
            </Section>

            <Section id="engine" eyebrow="Execution strategy" title="A transfer as a plan">
              <p>
                Sending one amount at one moment is the easiest thing in the world to
                correlate. The engine breaks a transfer into chunks with randomized sizes
                and jittered delays, each with its own quote and one-time deposit address,
                and persists the plan so an interrupted run resumes.
              </p>
              <p>
                Resume is the part that has to be exactly right: a chunk whose withdrawal
                already went on-chain is never withdrawn again — it re-attaches to its
                existing deposit address and polls to settlement. A chunk interrupted while
                the wallet dialog was open is probed first, and only retried if 1Click
                confirms nothing arrived.
              </p>
            </Section>

            <Section id="limits" eyebrow="The honest claim" title="What we hide, and what we don't">
              <p>
                Overclaiming is how privacy tools mislead the people who most need them.
                The precise claim is that the two sides are not linkable on-chain.
              </p>
              <ul className="flex flex-col gap-2">
                {LIMITS.map(([hidden, text]) => (
                  <li
                    key={String(text)}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3"
                  >
                    <span
                      className={
                        "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md " +
                        (hidden ? "bg-primary/12 text-primary" : "bg-warm/15 text-warm")
                      }
                    >
                      {hidden ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                    </span>
                    <span className="text-xs leading-relaxed text-foreground/80">{text}</span>
                  </li>
                ))}
              </ul>
              <p>
                Splitting and jitter raise the cost of amount-and-timing correlation; they
                do not eliminate it. What eliminates it is the pool getting busier.
              </p>
            </Section>

            <Section id="priorart" eyebrow="Prior art" title="ZODL proved the rail">
              <p>
                The closest shipped product is{" "}
                <a
                  href="https://intents.near.org/case-studies/zodl"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-4"
                >
                  ZODL
                </a>
                , a Zcash wallet reaching 31 chains over the same NEAR Intents rail, with
                $3M+ in fees earned. The pattern is market-validated, not speculative.
              </p>
              <p>
                The substantive difference is what carries the privacy. On ZODL it is the
                asset — you are private only while denominated in ZEC, so privacy costs a
                currency conversion. In a shielded pool the token you deposited is the
                token you hold, so a treasury can stay private in USDC. Mirage also holds
                no keys, and executes a plan rather than a single swap.
              </p>
            </Section>

            <Section id="status" eyebrow="Status" title="Shipped, and not">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-primary/40 bg-card p-5">
                  <h3 className="mb-3 font-serif text-lg font-medium text-foreground">
                    Live on mainnet
                  </h3>
                  <ul className="flex list-disc flex-col gap-1.5 pl-4 text-xs leading-relaxed">
                    <li>Shield and private send, any ERC-20</li>
                    <li>Bidirectional swap across 35 chains</li>
                    <li>In-pool conversion through the AVNU anonymizer</li>
                    <li>Split + jitter engine, resumable</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="mb-3 font-serif text-lg font-medium text-foreground">
                    Not shipped
                  </h3>
                  <ul className="flex list-disc flex-col gap-1.5 pl-4 text-xs leading-relaxed">
                    <li>
                      Headless engine — blocked on the mainnet proving URL (issue #135)
                    </li>
                    <li>TEE deployment with attestation surfaced in-app</li>
                    <li>Fresh execution account, which would isolate refunds</li>
                  </ul>
                </div>
              </div>
            </Section>

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-10">
              <Button size="lg" onClick={() => navigate("/app")} className="gap-2">
                Launch app <ArrowRight className="size-4" />
              </Button>
              <Button size="lg" variant="ghost" onClick={() => navigate("/")} className="gap-2">
                <ArrowLeft className="size-4" /> Back to overview
              </Button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
