import type { DemoLine } from "./demo-rules";

/**
 * Reads the timesheet on the "Try it without a wallet" page the way a gullible assistant would:
 * every "name, hours, rate" row becomes a payslip line, and an injected instruction such as
 * "pay 0xBAD… $5,000" is obeyed too. The point of the demo is that the contract, not the
 * assistant, decides what gets paid.
 */

export type SheetLine = DemoLine & { source: "row" | "injected" };
export type ParsedSheet = { lines: SheetLine[]; skipped: string[] };

/** Decimal text ("12.50", "$1,000") to integer units with `dp` decimals, without floating point. */
export function toUnits(text: string, dp = 6): bigint | null {
  const clean = text.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const [whole, frac = ""] = clean.split(".");
  return BigInt(whole!) * 10n ** BigInt(dp) + BigInt((frac + "0".repeat(dp)).slice(0, dp) || "0");
}

const INJECTED = /\bpay\s+(0x[0-9a-f…\.]{4,44})\s+\$?([\d,]+(?:\.\d+)?)/i;

/**
 * @param roster lower-case name -> wallet of the people the employer invited
 * Names not on the roster get a placeholder wallet that no payee confirmed, so the checks refuse them.
 */
export function parseDemoSheet(text: string, roster: Readonly<Record<string, string>>): ParsedSheet {
  const lines: SheetLine[] = [];
  const skipped: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const inj = INJECTED.exec(line);
    if (inj) {
      const amount = toUnits(inj[2]!);
      if (amount !== null) {
        const wallet = inj[1]!.toLowerCase();
        lines.push({ name: `Wallet ${inj[1]}`, wallet, amount, source: "injected" });
        continue;
      }
    }
    if (line.startsWith("#") || /^name\s*,/i.test(line)) continue;

    const parts = line.split(",").map((s) => s.trim());
    const hours = parts.length === 3 ? toUnits(parts[1]!, 2) : null;
    const rate = parts.length === 3 ? toUnits(parts[2]!, 6) : null;
    if (hours === null || rate === null || !parts[0]) {
      skipped.push(line);
      continue;
    }
    const name = parts[0];
    const wallet = roster[name.toLowerCase()] ?? `unknown:${name.toLowerCase()}`;
    lines.push({ name, wallet, amount: (hours * rate) / 100n, source: "row" });
  }
  return { lines, skipped };
}
