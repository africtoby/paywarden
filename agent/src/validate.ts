import { encodeAbiParameters, isHex, keccak256, stringToHex, zeroAddress, type Address, type Hex } from "viem";
import type { SignedSheet, Timesheet } from "./timesheet.js";

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

/** The EIP-712 message a worker signs. Must match PayrollVault: domain "PayWarden" v1, PayLine(payeeId, amount, memoHash). */
export function payLineTypedData(vault: Address, chainId: number, payeeId: Hex, amount: bigint, memoHash: Hex) {
  return {
    domain: { name: "PayWarden", version: "1", chainId, verifyingContract: vault },
    types: {
      PayLine: [
        { name: "payeeId", type: "bytes32" },
        { name: "amount", type: "uint256" },
        { name: "memoHash", type: "bytes32" },
      ],
    },
    primaryType: "PayLine",
    message: { payeeId, amount, memoHash },
  } as const;
}

export type SignedProposal = Proposal & { signatures: Hex[] };

/** Where the agent looks things up. Real one: the vault's payeeWallet + the public client's verifyTypedData (also handles smart wallets). */
export type SignatureContext = {
  vault: Address;
  chainId: number;
  wallet: (payeeId: Hex) => Promise<Address>;
  verifyTypedData: (a: ReturnType<typeof payLineTypedData> & { address: Address; signature: Hex }) => Promise<boolean>;
};

/**
 * Turns a worker-signed sheet into a proposal. Every line must carry a signature that verifies against the wallet
 * the person confirmed on the vault. Anything else throws an error naming the person; no line is dropped silently.
 */
export async function validateSigned(sheet: SignedSheet, payees: PayeeRecord[], ctx: SignatureContext): Promise<SignedProposal> {
  const byName = new Map(payees.map((p) => [p.name.toLowerCase(), p]));
  const memoHash = keccak256(stringToHex(sheet.memo));
  const seen = new Set<string>();
  const out: SignedProposal = { payeeIds: [], amounts: [], memoHash, lines: [], signatures: [] };

  for (const l of sheet.lines) {
    const key = l.name.toLowerCase();
    const payee = byName.get(key);
    if (!payee) throw new Error(`"${l.name}" is not in your payee list`);
    if (seen.has(key)) throw new Error(`"${l.name}" appears twice`);
    seen.add(key);

    const amount = toUnits(l.amount, TOKEN_DECIMALS);
    if (amount === 0n) throw new Error(`"${payee.name}" has a zero amount`);

    const signature = l.signature;
    if (!signature) throw new Error(`${payee.name}'s line is not signed. Every line needs ${payee.name}'s own signature.`);
    if (!isHex(signature)) throw new Error(`${payee.name}'s signature is not a valid hex string`);

    const payeeId = payeeIdOf(payee.name, payee.salt);
    const wallet = await ctx.wallet(payeeId);
    if (wallet === zeroAddress) throw new Error(`${payee.name} has not confirmed a wallet on the vault yet`);

    let valid = false;
    try {
      valid = await ctx.verifyTypedData({ ...payLineTypedData(ctx.vault, ctx.chainId, payeeId, amount, memoHash), address: wallet, signature });
    } catch {
      valid = false; // malformed signature bytes: same outcome as a wrong one
    }
    if (!valid) throw new Error(`${payee.name}'s signature does not match this line (${l.amount}) for "${sheet.memo}", or was not made by the wallet ${payee.name} confirmed`);

    out.payeeIds.push(payeeId);
    out.amounts.push(amount);
    out.lines.push({ name: payee.name, amount });
    out.signatures.push(signature);
  }
  return out;
}
