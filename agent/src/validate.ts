import { encodeAbiParameters, keccak256, stringToHex, type Hex } from "viem";
import type { Timesheet } from "./timesheet.js";

export const TOKEN_DECIMALS = 6;
export const MAX_HOURS = 400; // per period
export const MAX_RATE = 10_000; // per hour

export type PayeeRecord = { name: string; salt: Hex };
export type Proposal = {
  payeeIds: Hex[];
  amounts: bigint[];
  memoHash: Hex;
  lines: { name: string; amount: bigint }[];
};

/** Decimal string -> integer scaled by 10^dp, exact (no floats). Rejects extra precision. */
export function toUnits(value: string, dp: number): bigint {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!m) throw new Error(`"${value}" is not a plain positive number`);
  const frac = m[2] ?? "";
  if (frac.length > dp) throw new Error(`"${value}" has more than ${dp} decimal places`);
  return BigInt(m[1]! + frac.padEnd(dp, "0"));
}

export function payeeIdOf(name: string, salt: Hex): Hex {
  return keccak256(encodeAbiParameters([{ type: "string" }, { type: "bytes32" }], [name, salt]));
}

export function validate(sheet: Timesheet, payees: PayeeRecord[]): Proposal {
  const byName = new Map(payees.map((p) => [p.name.toLowerCase(), p]));
  const seen = new Set<string>();
  const payeeIds: Hex[] = [];
  const amounts: bigint[] = [];
  const lines: Proposal["lines"] = [];

  for (const e of sheet.entries) {
    const key = e.name.toLowerCase();
    const payee = byName.get(key);
    if (!payee) throw new Error(`"${e.name}" is not in your payee list`);
    if (seen.has(key)) throw new Error(`"${e.name}" appears twice`);
    seen.add(key);

    const hours = toUnits(e.hours, 2); // hours x 100
    const rate = toUnits(e.rate, TOKEN_DECIMALS); // tUSD8 units per hour
    if (hours === 0n || rate === 0n) throw new Error(`"${e.name}" has zero hours or rate`);
    if (hours > BigInt(MAX_HOURS) * 100n) throw new Error(`"${e.name}": ${e.hours} hours is over the ${MAX_HOURS} limit`);
    if (rate > BigInt(MAX_RATE) * 10n ** BigInt(TOKEN_DECIMALS)) throw new Error(`"${e.name}": rate is over ${MAX_RATE} per hour`);

    const amount = (hours * rate) / 100n; // undo the x100 on hours -> tUSD8 units (6 dp)
    payeeIds.push(payeeIdOf(payee.name, payee.salt));
    amounts.push(amount);
    lines.push({ name: payee.name, amount });
  }
  return { payeeIds, amounts, memoHash: keccak256(stringToHex(sheet.memo)), lines };
}
