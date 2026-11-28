import { describe, expect, it } from "vitest";
import { keccak256, stringToHex, verifyTypedData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { lineAmount, memoHashOf, payLineTypedData, signedLineJson } from "./pay-line";

const VAULT = "0x98F3C81b754574f08e57bf35bb6BED38e4bD5a36";
const ID = keccak256(stringToHex("ada"));

describe("worker pay line", () => {
  it("hashes the memo like the agent does", () => {
    expect(memoHashOf("Week 48")).toBe(keccak256(stringToHex("Week 48")));
  });

  it("multiplies hours by rate in token units", () => {
    expect(lineAmount("40", "$15.00")).toBe(600_000_000n);
    expect(lineAmount("2.5", "0.25")).toBe(625_000n);
    expect(lineAmount("abc", "15")).toBeNull();
  });

  it("signs a typed line that verifies for the worker's wallet and no one else's", async () => {
    const worker = privateKeyToAccount(`0x${"11".repeat(32)}`);
    const other = privateKeyToAccount(`0x${"22".repeat(32)}`);
    const data = payLineTypedData(VAULT, 44005, ID, 600_000_000n, memoHashOf("Week 48"));
    const signature = await worker.signTypedData(data);
    expect(await verifyTypedData({ ...data, address: worker.address, signature })).toBe(true);
    expect(await verifyTypedData({ ...data, address: other.address, signature })).toBe(false);
    // A different amount is a different line.
    const bigger = payLineTypedData(VAULT, 44005, ID, 600_000_001n, memoHashOf("Week 48"));
    expect(await verifyTypedData({ ...bigger, address: worker.address, signature })).toBe(false);
  });

  it("writes the JSON the agent reads, with the amount in dollars", () => {
    const json = JSON.parse(signedLineJson("Ada", "Week 48", 600_000_000n, "0xabc")) as { memo: string; lines: { name: string; amount: string; signature: string }[] };
    expect(json).toEqual({ memo: "Week 48", lines: [{ name: "Ada", amount: "600", signature: "0xabc" }] });
  });
});
