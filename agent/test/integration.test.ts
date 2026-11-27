import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublicClient, createTestClient, createWalletClient, defineChain, http, parseEventLogs, type Abi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { vaultAbi } from "../src/abi.js";
import { submitRun } from "../src/submit.js";
import { validate, payeeIdOf } from "../src/validate.js";
import { parseRules } from "../src/parse-rules.js";

// Local anvil (no fork) + the real contracts from contracts/out. Skipped if anvil is not installed.
const anvilBin = [path.join(homedir(), ".foundry", "bin", "anvil"), "anvil"].find(
  (b) => spawnSync(b, ["--version"], { shell: process.platform === "win32" }).status === 0,
);
const PORT = 8599;
const url = `http://127.0.0.1:${PORT}`;
const chain = defineChain({ id: 31337, name: "local", nativeCurrency: { name: "E", symbol: "E", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
const keys = {
  owner: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  agent: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f88d7d4d3f0bd0",
  ada: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdd6e7dc",
  grace: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
} as const;
const out = path.resolve(__dirname, "../../contracts/out");
const artifact = (file: string, name: string) => {
  const j = JSON.parse(readFileSync(path.join(out, `${file}.sol`, `${name}.json`), "utf8"));
  return { abi: j.abi as Abi, bytecode: j.bytecode.object as Hex };
};

const USD = 10n ** 6n;
const saltA = `0x${"aa".repeat(32)}` as Hex;
const saltG = `0x${"bb".repeat(32)}` as Hex;
const payees = [
  { name: "Ada Lovelace", salt: saltA },
  { name: "Grace Hopper", salt: saltG },
];

describe.skipIf(!anvilBin)("agent against a real vault (local anvil)", () => {
  let proc: ChildProcess;
  const pub = createPublicClient({ chain, transport: http() });
  const test = createTestClient({ chain, mode: "anvil", transport: http() });
  const wallet = (k: Hex) => createWalletClient({ chain, account: privateKeyToAccount(k), transport: http() });
  let vault: Address;
  const agent = privateKeyToAccount(keys.agent);
  const deps = () => ({ pub, wallet: wallet(keys.agent), account: agent, vault, baseMs: 1 });

  beforeAll(async () => {
    proc = spawn(anvilBin!, ["--port", String(PORT), "--silent"], { shell: process.platform === "win32" });
    for (let i = 0; i < 50; i++) {
      try { await pub.getChainId(); break; } catch { await new Promise((r) => setTimeout(r, 200)); }
    }
    for (const k of Object.values(keys)) {
      await test.setBalance({ address: privateKeyToAccount(k).address, value: 10n ** 20n });
    }
    const owner = wallet(keys.owner);
    const deploy = async (file: string, name: string, args: unknown[] = []) => {
      const a = artifact(file, name);
      const hash = await owner.deployContract({ abi: a.abi, bytecode: a.bytecode, args });
      return (await pub.waitForTransactionReceipt({ hash })).contractAddress as Address;
    };
    const token = await deploy("Base.t", "MockUSD8");
    const registry = await deploy("IdentityRegistry", "IdentityRegistry");
    const factory = await deploy("PayrollVaultFactory", "PayrollVaultFactory", [token, registry]);
    const fAbi = artifact("PayrollVaultFactory", "PayrollVaultFactory").abi;
    const tx = await owner.writeContract({ address: factory, abi: fAbi, functionName: "createVault", args: [0n] });
    const rc = await pub.waitForTransactionReceipt({ hash: tx });
    const created = parseEventLogs({ abi: fAbi, logs: rc.logs, eventName: "VaultCreated" })[0]!.args as { vault: Address; policy: Address };
    vault = created.vault;

    const pAbi = artifact("AgentSpendPolicy", "AgentSpendPolicy").abi;
    await pub.waitForTransactionReceipt({
      hash: await owner.writeContract({
        address: created.policy, abi: pAbi, functionName: "setPolicy",
        args: [{ agent: agent.address, perRun: 5_000n * USD, perPayee: 3_000n * USD, periodCap: 8_000n * USD, period: 86_400n, expiry: BigInt(Math.floor(Date.now() / 1000) + 86_400 * 30) }],
      }),
    });

    // Ada confirms her wallet; Grace is invited but never confirms.
    const vAbi = artifact("PayrollVault", "PayrollVault").abi;
    for (const p of payees) {
      await pub.waitForTransactionReceipt({ hash: await owner.writeContract({ address: vault, abi: vAbi, functionName: "invitePayee", args: [payeeIdOf(p.name, p.salt), "0x0000000000000000000000000000000000000000"] }) });
    }
    await pub.waitForTransactionReceipt({ hash: await wallet(keys.ada).writeContract({ address: vault, abi: vAbi, functionName: "confirmPayee", args: ["Ada Lovelace", saltA] }) });
  }, 60_000);

  afterAll(() => { proc?.kill(); });

  const sheet = (lines: string) => validate(parseRules(lines), payees);

  it("proposes an honest run, waits for the receipt, and a retry is idempotent", async () => {
    const p = sheet("memo: Week 12\nAda Lovelace, 40, 25.50");
    const first = await submitRun(deps(), p);
    expect(first.status).toBe("proposed");
    const again = await submitRun(deps(), p);
    expect(again.status).toBe("already-proposed");
  });

  it("poisoned: pay over the per-person cap is refused by the CONTRACT", async () => {
    // Passes our sanity limits (400h x 10000) but not the owner's on-chain caps.
    const p = sheet("memo: poisoned\nAda Lovelace, 400, 9000");
    const r = await submitRun(deps(), p);
    expect(r).toMatchObject({ status: "refused", errorName: "PerPayeeCapExceeded" });
    expect((r as { message: string }).message).toContain("$3,600,000"); // 400 h x 9000, written in dollars
  });

  it("poisoned: a payee who has not confirmed is refused by the contract", async () => {
    const r = await submitRun(deps(), sheet("memo: ghost\nGrace Hopper, 10, 10"));
    expect(r).toMatchObject({ status: "refused", errorName: "PayeeNotConfirmed" });
  });

  it("poisoned: bypassing our own validation, a hand-built bad proposal is still refused", async () => {
    const r = await submitRun(deps(), {
      payeeIds: [payeeIdOf("Ada Lovelace", saltA)],
      amounts: [1_000_000n * USD],
      memoHash: `0x${"00".repeat(32)}`,
      lines: [],
    });
    expect(r).toMatchObject({ status: "refused" });
  });

  it("a wallet that is not the assistant is refused", async () => {
    const other = privateKeyToAccount(keys.grace);
    const r = await submitRun({ ...deps(), wallet: wallet(keys.grace), account: other }, sheet("Ada Lovelace, 1, 1"));
    expect(r).toMatchObject({ status: "refused", errorName: "NotAgent" });
  });
});

void vaultAbi;
