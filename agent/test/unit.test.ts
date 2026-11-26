import { describe, expect, it, vi } from "vitest";
import { parseRules } from "../src/parse-rules.js";
import { parseLlm } from "../src/parse-llm.js";
import { parseTimesheet } from "../src/run.js";
import { toUnits, validate, payeeIdOf } from "../src/validate.js";
import { withRetry } from "../src/submit.js";
import { isRetryable } from "../src/errors.js";
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
