import { RpcProvider } from "starknet";

export const STRK =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

export const SN_MAIN = "0x534e5f4d41494e";

export const provider = new RpcProvider({
  nodeUrl:
    import.meta.env.VITE_RPC_URL ??
    "https://api.zan.top/public/starknet-mainnet/rpc/v0_10",
});

export const explorerTx = (h: string) => `https://voyager.online/tx/${h}`;

export function fmtStrk(amount: bigint): string {
  const whole = amount / 10n ** 18n;
  const frac = (amount % 10n ** 18n)
    .toString()
    .padStart(18, "0")
    .replace(/0+$/, "")
    .slice(0, 6);
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export function parseStrk(s: string): bigint {
  const [whole, frac = ""] = s.trim().split(".");
  return BigInt(whole || "0") * 10n ** 18n + BigInt(frac.padEnd(18, "0").slice(0, 18));
}

export const shortHex = (h: string) =>
  h.length <= 13 ? h : `${h.slice(0, 7)}…${h.slice(-5)}`;
