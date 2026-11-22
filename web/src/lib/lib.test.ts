import { describe, expect, it } from "vitest";
import { encodeAbiParameters, keccak256, toHex } from "viem";
import { formatAmount, formatDuration, parseAmount } from "./format";
import { inviteLink, payeeId, randomSalt } from "./payee";
import { explainRevert, MESSAGES } from "./errors";
import { payrollVaultAbi, agentSpendPolicyAbi } from "./contracts";

describe("amounts (tUSD8, 6 decimals)", () => {
  it("parses and formats", () => {
    expect(parseAmount("1450.5")).toBe(1_450_500_000n);
    expect(formatAmount(1_450_000_000n)).toBe("1,450");
  });
  it("rejects bad input", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("-1")).toBeNull();
    expect(parseAmount("1.1234567")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
  it("formats durations", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(75)).toBe("1m 15s");
    expect(formatDuration(7200)).toBe("2h 0m");
  });
});

describe("payee id", () => {
  it("equals keccak256(abi.encode(name, salt)) like the contract", () => {
    const salt = toHex(1n, { size: 32 });
    const expected = keccak256(encodeAbiParameters([{ type: "string" }, { type: "bytes32" }], ["Ada", salt]));
    expect(payeeId("Ada", salt)).toBe(expected);
  });
  it("differs with salt and name", () => {
    const a = randomSalt();
    expect(payeeId("Ada", a)).not.toBe(payeeId("Ada", randomSalt()));
    expect(payeeId("Ada", a)).not.toBe(payeeId("Bob", a));
  });
  it("builds an invite link that carries name and salt in the fragment", () => {
    const link = inviteLink("https://x.test", "0xabc", "Ada Lovelace", toHex(2n, { size: 32 }));
    expect(link.startsWith("https://x.test/confirm#")).toBe(true);
    expect(new URLSearchParams(link.split("#")[1]).get("name")).toBe("Ada Lovelace");
  });
});

describe("error messages", () => {
  const errorNames = (abi: readonly { type: string; name?: string }[]) =>
    abi.filter((x) => x.type === "error").map((x) => x.name as string);

  it("covers every custom error in the vault and policy ABIs", () => {
    const names = [...errorNames(payrollVaultAbi), ...errorNames(agentSpendPolicyAbi)];
    const missing = names.filter((n) => !MESSAGES[n]);
    expect(missing).toEqual([]);
  });
  it("explains caps with amounts", () => {
    expect(explainRevert("PerRunCapExceeded", [5_000_000_000n, 1_000_000_000n])).toContain("5,000 tUSD8");
  });
  it("returns null for unknown errors", () => {
    expect(explainRevert("Nope")).toBeNull();
  });
});
