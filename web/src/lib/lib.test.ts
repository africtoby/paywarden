import { describe, expect, it } from "vitest";
import { encodeAbiParameters, keccak256, toHex } from "viem";
import { formatAmount, formatDuration, parseAmount } from "./format";
import { inviteLink, payeeId, randomSalt } from "./payee";
import { explainRevert, MESSAGES } from "./errors";
import { payrollVaultAbi, agentSpendPolicyAbi } from "./contracts";
import { evaluateDraft, type DemoPolicy } from "./demo-rules";
import { checkRun } from "./run-checks";
import { permissionSentence } from "./assistant-sentence";

describe("landing demo rules mirror the contract", () => {
  const ada = "0x7a3f00000000000000000000000000000000a91c";
  const kemi = "0x51be0000000000000000000000000000000004d2";
  const policy: DemoPolicy = {
    confirmed: new Set([ada, kemi]),
    perPayee: 800_000_000n,
    perRun: 2_000_000_000n,
    periodLeft: 4_000_000_000n,
    expired: false,
    paused: false,
    alreadyPaid: false,
  };
  const honest = [
    { name: "Ada", wallet: ada, amount: 600_000_000n },
    { name: "Kemi", wallet: kemi, amount: 450_000_000n },
  ];

  it("passes all seven checks for an honest timesheet", () => {
    const r = evaluateDraft(honest, policy);
    expect(r.checks.every((c) => c.ok)).toBe(true);
    expect(r.refusal).toBeNull();
    expect(r.total).toBe(1_050_000_000n);
  });

  it("refuses a poisoned line: unknown wallet and over the per-person cap", () => {
    const r = evaluateDraft([...honest, { name: "SYSTEM", wallet: "0xbad0000000000000000000000000000000000001", amount: 5_000_000_000n }], policy);
    const failed = r.checks.filter((c) => !c.ok).map((c) => c.label);
    expect(failed).toContain("Confirmed payee");
    expect(failed).toContain("Per-person cap");
    expect(r.refusal).toMatch(/not confirmed/);
  });

  it("refuses a confirmed payee paid over the cap", () => {
    const r = evaluateDraft([{ name: "Ada", wallet: ada, amount: 900_000_000n }], policy);
    expect(r.refusal).toMatch(/per-person cap/);
  });
});

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

describe("run checks (live state)", () => {
  const policy = { agent: "0x0000000000000000000000000000000000000001" as const, perRun: 2_000_000_000n, perPayee: 800_000_000n, periodCap: 5_000_000_000n, period: 2_592_000n, expiry: 0n };
  const base = { amounts: [600_000_000n, 450_000_000n], total: 1_050_000_000n, status: "Proposed" as const, confirmedCount: 2, payeeCount: 2, policy, revoked: false, paused: false, remaining: 4_000_000_000n, now: 1_000 };

  it("passes seven of seven for an honest run", () => {
    const r = checkRun(base);
    expect(r.checks).toHaveLength(7);
    expect(r.checks.every((c) => c.ok)).toBe(true);
    expect(r.refusal).toBeNull();
  });
  it("reports the first failing rule in contract order", () => {
    const r = checkRun({ ...base, confirmedCount: 1, amounts: [900_000_000n, 450_000_000n] });
    expect(r.checks.filter((c) => !c.ok).map((c) => c.label)).toEqual(["Confirmed payee", "Per-person cap"]);
    expect(r.refusal).toMatch(/not confirmed/);
  });
  it("refuses when the vault is paused or the assistant is switched off", () => {
    expect(checkRun({ ...base, paused: true }).refusal).toMatch(/paused/);
    expect(checkRun({ ...base, revoked: true }).refusal).toMatch(/turned off/);
  });
  it("treats a paid run as 7/7", () => {
    expect(checkRun({ ...base, status: "Executed", paused: true }).checks.every((c) => c.ok)).toBe(true);
  });
});

describe("permission sentence", () => {
  it("reads in plain English", () => {
    const s = permissionSentence({ perPayee: 800_000_000n, perRun: 2_000_000_000n, periodCap: 5_000_000_000n, periodDays: 30, expiry: null });
    expect(s).toContain("up to 800 per person, 2,000 per run and 5,000 a month");
    expect(s).toContain("no end date");
  });
});
