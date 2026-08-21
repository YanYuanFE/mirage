# Mirage

**One wallet, every chain, no trace.**

Mirage is a privacy superapp built for the [STRK20 Private Sprint](https://strk20.starknet.io/hackathon). It turns the STRK20 shielded pool on Starknet into a privacy gateway to 35+ chains: shield any ERC-20 on Starknet, then send value to any supported chain — BTC, Base, Solana, Arbitrum, TON, and more — with no on-chain link between your main wallet and the destination address.

## How it works

```
Any ERC-20 (USDC / ETH / STRK ...)
   │  shield into STRK20 pool
   ▼
Private in-pool swap → STRK          (AVNU anonymizer)
   │  unshield to a fresh account
   ▼
NEAR Intents 1Click deposit          (one-time deposit address)
   │  solvers execute cross-chain
   ▼
186 assets on 35 chains, delivered to a fresh address
```

Three primitives, one flow:

1. **STRK20 shielded pool** — breaks the link between your main wallet and outgoing funds.
2. **NEAR Intents (1Click API)** — intent-based cross-chain execution; every transfer uses a one-time deposit address, no fixed bridge path.
3. **Workflow engine** — splits amounts and randomizes timing so value can't be re-linked by correlation; runs in a TEE (Phala Cloud) with remote attestation.

Bidirectional: the same rail runs in reverse (**Return**), so you can fund a fresh, unlinkable identity on another chain — Hyperliquid, Polymarket — trade there, and bring the proceeds back into your shielded balance. Mirage hides the *link* to you, not the on-venue activity: your positions are visible on the venue, just not provably yours.

## Documentation

- [Architecture & technical design](docs/ARCHITECTURE.md)

## Status

Building in public for the Private Sprint (Aug 14 – Aug 31, 2026). See [`strk20.json`](strk20.json) for demo, contracts, and mainnet transactions as they land.

## License

[MIT](LICENSE)
