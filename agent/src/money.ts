/** 6-decimal token units -> "$1,450" or "$0.80". Whole amounts drop the decimals; anything else shows cents. */
export function money(units: unknown): string {
  const n = Math.round((Number(units) / 1e6) * 100) / 100;
  const digits = Number.isInteger(n) ? 0 : 2;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
}
