import { describe, expect, it, vi } from "vitest";
import { parseRules } from "../src/parse-rules.js";
import { parseLlm } from "../src/parse-llm.js";
import { parseTimesheet } from "../src/run.js";
import { BaseError, ContractFunctionRevertedError, keccak256, stringToHex, verifyTypedData, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { toUnits, validate, validateSigned, payeeIdOf, payLineTypedData } from "../src/validate.js";
import { withRetry } from "../src/submit.js";
import { explain, isRetryable } from "../src/errors.js";
import { money } from "../src/money.js";

const salt = `0x${"11".repeat(32)}` as const;
const payees = [
  { name: "Ada Lovelace", salt },
  { name: "Grace Hopper", salt },
];

describe("toUnits", () => {
  it("converts exactly", () => {
    expect(toUnits("25.5", 6)).toBe(25_500_000n);
    expect(toUnits("40", 2)).toBe(4000n);
  });
  it("rejects bad input", () => {
    for (const bad of ["-1", "1e3", "abc", "", "1.2345678", "0x10"]) expect(() => toUnits(bad, 6)).toThrow();
  });
});

describe("parseRules (no-LLM fallback)", () => {
  it("reads memo and lines", () => {
    const s = parseRules("memo: Week 12\nAda Lovelace, 40, 25.50\n# note\nGrace Hopper, 32.5, 30");
    expect(s.memo).toBe("Week 12");
    expect(s.entries).toHaveLength(2);
  });
  it("rejects a malformed line", () => {
    expect(() => parseRules("Ada, 40")).toThrow(/Cannot read line/);
  });
  it("accepts a leading dollar sign on the rate", () => {
    const s = parseRules("Ada Lovelace, 40, $25.50\nGrace Hopper, 32.5, $ 30");
    expect(s.entries.map((e) => e.rate)).toEqual(["25.50", "30"]);
  });
});

describe("money", () => {
  it("shows whole amounts without decimals and others with cents", () => {
    expect(money(1_450_000_000n)).toBe("$1,450");
    expect(money(500_000_000n)).toBe("$500");
    expect(money(800_000n)).toBe("$0.80");
    expect(money(500_000n)).toBe("$0.50");
    expect(money(0n)).toBe("$0");
  });
});

describe("validate", () => {
  const sheet = (e: { name: string; hours: string; rate: string }[]) => ({ memo: "w1", entries: e });

  it("computes 6-dp amounts and payee ids", () => {
    const p = validate(sheet([{ name: "Ada Lovelace", hours: "40", rate: "25.50" }]), payees);
    expect(p.amounts).toEqual([1_020_000_000n]);
    expect(p.payeeIds[0]).toBe(payeeIdOf("Ada Lovelace", salt));
  });
  it("handles fractional hours", () => {
    expect(validate(sheet([{ name: "Grace Hopper", hours: "32.5", rate: "30" }]), payees).amounts).toEqual([975_000_000n]);
  });
  it("rejects unknown, duplicate, zero and absurd entries", () => {
    expect(() => validate(sheet([{ name: "Mallory", hours: "1", rate: "1" }]), payees)).toThrow(/not in your payee list/);
    const dup = { name: "Ada Lovelace", hours: "1", rate: "1" };
    expect(() => validate(sheet([dup, dup]), payees)).toThrow(/twice/);
    expect(() => validate(sheet([{ name: "Ada Lovelace", hours: "0", rate: "1" }]), payees)).toThrow(/zero/);
    expect(() => validate(sheet([{ name: "Ada Lovelace", hours: "9999", rate: "1" }]), payees)).toThrow(/limit/);
    expect(() => validate(sheet([{ name: "Ada Lovelace", hours: "1", rate: "99999" }]), payees)).toThrow(/rate/);
  });
});

describe("validateSigned (worker-signed lines)", () => {
  const vault = "0x00000000000000000000000000000000000000aa" as const;
  const chainId = 31337;
  const ada = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdd6e7dc");
  const grace = privateKeyToAccount("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");
  const mallory = privateKeyToAccount("0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a");
  const memoHash = keccak256(stringToHex("Week 48"));
  const adaId = payeeIdOf("Ada Lovelace", salt);
  const graceId = payeeIdOf("Grace Hopper", salt);
  const confirmed = new Map<string, `0x${string}`>([[adaId, ada.address]]); // Grace never confirmed

  const ctx = (wallets = confirmed) => ({
    vault,
    chainId,
    wallet: async (id: `0x${string}`) => wallets.get(id) ?? zeroAddress,
    verifyTypedData: (a: Parameters<typeof verifyTypedData>[0]) => verifyTypedData(a),
  });
  const sign = (who: typeof ada, id: `0x${string}`, amount: bigint) =>
    who.signTypedData(payLineTypedData(vault, chainId, id, amount, memoHash));
  const sheet = (lines: { name: string; amount: string; signature?: string }[]) => ({ memo: "Week 48", lines });

  it("accepts a line signed by the confirmed wallet and returns the signature", async () => {
    const signature = await sign(ada, adaId, 500_000n);
    const p = await validateSigned(sheet([{ name: "Ada Lovelace", amount: "0.50", signature }]), payees, ctx());
    expect(p.amounts).toEqual([500_000n]);
    expect(p.signatures).toEqual([signature]);
    expect(p.payeeIds).toEqual([adaId]);
  });
  it("refuses an unsigned line and names the person", async () => {
    await expect(validateSigned(sheet([{ name: "Ada Lovelace", amount: "0.50" }]), payees, ctx())).rejects.toThrow(/Ada Lovelace's line is not signed/);
  });
  it("refuses an empty signature and a non-hex one", async () => {
    await expect(validateSigned(sheet([{ name: "Ada Lovelace", amount: "0.50", signature: "" }]), payees, ctx())).rejects.toThrow(/not signed/);
    await expect(validateSigned(sheet([{ name: "Ada Lovelace", amount: "0.50", signature: "nope" }]), payees, ctx())).rejects.toThrow(/Ada Lovelace's signature is not a valid/);
    await expect(validateSigned(sheet([{ name: "Ada Lovelace", amount: "0.50", signature: "0xdead" }]), payees, ctx())).rejects.toThrow(/Ada Lovelace's signature does not match/);
  });
  it("refuses a tampered amount", async () => {
    const signature = await sign(ada, adaId, 500_000n); // signed $0.50
    await expect(validateSigned(sheet([{ name: "Ada Lovelace", amount: "5.00", signature }]), payees, ctx())).rejects.toThrow(/Ada Lovelace's signature does not match/);
  });
  it("refuses a signature from someone else's wallet", async () => {
    const signature = await sign(mallory, adaId, 500_000n);
    await expect(validateSigned(sheet([{ name: "Ada Lovelace", amount: "0.50", signature }]), payees, ctx())).rejects.toThrow(/Ada Lovelace's signature does not match/);
  });
  it("refuses Ada's signature reused on Grace's line", async () => {
    const wallets = new Map(confirmed).set(graceId, grace.address);
    const signature = await sign(ada, adaId, 500_000n);
    await expect(validateSigned(sheet([{ name: "Grace Hopper", amount: "0.50", signature }]), payees, ctx(wallets))).rejects.toThrow(/Grace Hopper's signature does not match/);
  });
  it("refuses a payee who has not confirmed a wallet, an unknown name, a duplicate and a zero amount", async () => {
    const g = await sign(grace, graceId, 500_000n);
    await expect(validateSigned(sheet([{ name: "Grace Hopper", amount: "0.50", signature: g }]), payees, ctx())).rejects.toThrow(/Grace Hopper has not confirmed/);
    await expect(validateSigned(sheet([{ name: "Mallory", amount: "1", signature: "0x00" }]), payees, ctx())).rejects.toThrow(/not in your payee list/);
    const signature = await sign(ada, adaId, 500_000n);
    const line = { name: "Ada Lovelace", amount: "0.50", signature };
    await expect(validateSigned(sheet([line, line]), payees, ctx())).rejects.toThrow(/twice/);
    await expect(validateSigned(sheet([{ ...line, amount: "0" }]), payees, ctx())).rejects.toThrow(/zero amount/);
  });
  it("refuses a signature made for another vault or chain", async () => {
    const other = await ada.signTypedData(payLineTypedData("0x00000000000000000000000000000000000000bb", chainId, adaId, 500_000n, memoHash));
    await expect(validateSigned(sheet([{ name: "Ada Lovelace", amount: "0.50", signature: other }]), payees, ctx())).rejects.toThrow(/does not match/);
    const wrongChain = await ada.signTypedData(payLineTypedData(vault, 1, adaId, 500_000n, memoHash));
    await expect(validateSigned(sheet([{ name: "Ada Lovelace", amount: "0.50", signature: wrongChain }]), payees, ctx())).rejects.toThrow(/does not match/);
  });
});

describe("plain-English signature errors", () => {
  const lines = [{ payeeId: "0xabc", name: "Ada", amount: 500_000n }];
  const revert = (errorName: string, args: unknown[]) => {
    const inner = Object.assign(Object.create(ContractFunctionRevertedError.prototype), { data: { errorName, args } });
    return Object.assign(Object.create(BaseError.prototype), { walk: () => inner });
  };
  it("names the person and the dollar amount", () => {
    expect(explain(revert("InvalidWorkerSignature", ["0xabc"]), lines).message).toBe("Ada's $0.50 line is not signed by the wallet that person confirmed.");
    expect(explain(revert("LineAlreadyPaid", ["0xabc", "0x01"]), lines).message).toContain("Ada's $0.50 line was already paid");
  });
  it("falls back to the short payee id when the line is unknown", () => {
    expect(explain(revert("InvalidWorkerSignature", ["0x1234567890abcdef"]), []).message).toContain("0x12345678...");
  });
});

describe("LLM parser", () => {
  const reply = (text: string) =>
    vi.fn(async () => new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200 }));

  it("accepts JSON that fits the schema", async () => {
    const fetchImpl = reply('{"memo":"w","entries":[{"name":"Ada Lovelace","hours":40,"rate":25.5}]}');
    const s = await parseLlm("x", { apiKey: "k", model: "m", fetchImpl });
    expect(s.entries[0]).toMatchObject({ hours: "40", rate: "25.5" });
  });
  it("rejects JSON that does not fit", async () => {
    const fetchImpl = reply('{"entries":[]}');
    await expect(parseLlm("x", { apiKey: "k", model: "m", fetchImpl })).rejects.toThrow();
  });
  it("falls back to the plain parser when the LLM fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    const s = await parseTimesheet("Ada Lovelace, 40, 25", { useLlm: true, llmKey: "k", llmModel: "m" });
    expect(s.entries).toHaveLength(1);
    vi.unstubAllGlobals();
    warn.mockRestore();
  });
  it("uses the plain parser when the flag is off", async () => {
    const s = await parseTimesheet("Ada Lovelace, 40, 25", { useLlm: false, llmModel: "m" });
    expect(s.entries[0]!.name).toBe("Ada Lovelace");
  });
});

describe("withRetry", () => {
  it("retries network errors with backoff, then succeeds", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockRejectedValueOnce(new Error("timeout")).mockResolvedValue("ok");
    await expect(withRetry(fn, 4, 1)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });
  it("gives up after the last try", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("down"));
    await expect(withRetry(fn, 3, 1)).rejects.toThrow("down");
    expect(fn).toHaveBeenCalledTimes(3);
  });
  it("treats plain errors as retryable", () => {
    expect(isRetryable(new Error("x"))).toBe(true);
  });
});
