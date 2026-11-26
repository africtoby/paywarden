import { formatUnits, parseUnits } from "viem";
import { TOKEN_DECIMALS } from "./contracts";

/** 1450000000n -> "1,450" (tUSD8 has 6 decimals). */
export function formatAmount(raw: bigint, maxFraction = 2): string {
  const n = Number(formatUnits(raw, TOKEN_DECIMALS));
  return n.toLocaleString("en-US", { maximumFractionDigits: maxFraction });
}

/** 1450000000n -> "$1,450", 800000n -> "$0.80". Whole amounts drop the decimals; anything else shows cents. */
export function formatMoney(raw: bigint): string {
  const n = Math.round(Number(formatUnits(raw, TOKEN_DECIMALS)) * 100) / 100;
  const digits = Number.isInteger(n) ? 0 : 2;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** "1450.50" -> 1450500000n. Returns null when the text is not a valid amount. */
export function parseAmount(text: string): bigint | null {
  const t = text.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(t)) return null;
  return parseUnits(t, TOKEN_DECIMALS);
}

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const shortHash = (h: string) => `${h.slice(0, 8)}…${h.slice(-6)}`;

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}
