import { formatUnits, keccak256, stringToHex, type Address, type Hex } from "viem";
import { TOKEN_DECIMALS } from "./contracts";
import { toUnits } from "./demo-timesheet";

/** The memo is hashed the same way the agent does: keccak256 of its UTF-8 bytes. */
export const memoHashOf = (memo: string): Hex => keccak256(stringToHex(memo));

/**
 * The EIP-712 message a worker signs. Must match PayrollVault:
 * domain "PayWarden" v1 on the chain and vault, PayLine(payeeId, amount, memoHash).
 * Same shape as agent/src/validate.ts payLineTypedData.
 */
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

/** hours (2 dp) x rate (6 dp) in token units, without floating point. Null if either is not a number. */
export function lineAmount(hours: string, rate: string): bigint | null {
  const h = toUnits(hours, 2);
  const r = toUnits(rate, TOKEN_DECIMALS);
  return h === null || r === null ? null : (h * r) / 100n;
}

/** The text the worker sends to the employer: the agent's signed-timesheet JSON. Amount is in dollars. */
export function signedLineJson(name: string, memo: string, amount: bigint, signature: Hex): string {
  return JSON.stringify({ memo, lines: [{ name, amount: formatUnits(amount, TOKEN_DECIMALS), signature }] }, null, 2);
}
