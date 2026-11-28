import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  defineChain,
  encodeFunctionData,
  http,
  keccak256,
  parseAbi,
  parseEventLogs,
  stringToHex,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { vaultAbi } from "../src/abi.js";
import { ENTRY_POINT_V07, buildProposeOp, entryPointAbi, explainEntryPoint, pack128, submitRunViaAccount } from "../src/smart-account.js";
import { payLineTypedData, payeeIdOf, toUnits, validateSigned } from "../src/validate.js";

// Unit checks that need no chain.
describe("smart-account helpers", () => {
  it("packs two 128-bit values high then low", () => {
    expect(pack128(1n, 2n)).toBe(`0x${"0".repeat(31)}1${"0".repeat(31)}2`);
  });
  it("explains EntryPoint codes in plain English", () => {
    expect(explainEntryPoint("AA24 signature error")).toMatchObject({ name: "EntryPointAA24" });
    expect(explainEntryPoint("AA22 expired or not due").message).toMatch(/expired/);
    expect(explainEntryPoint("AA99 something").message).toMatch(/AA99/);
  });
});

// Local anvil + the canonical EntryPoint v0.7 bytecode + the real contracts. Skipped if anvil is not installed.
const anvilBin = [path.join(homedir(), ".foundry", "bin", "anvil"), "anvil"].find(
  (b) => spawnSync(b, ["--version"], { shell: process.platform === "win32" }).status === 0,
);
const PORT = 8598;
const url = `http://127.0.0.1:${PORT}`;
const chain = defineChain({ id: 31337, name: "local", nativeCurrency: { name: "E", symbol: "E", decimals: 18 }, rpcUrls: { default: { http: [url] } } });
const keys = {
  owner: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  relayer: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdd6e7dc",
  ada: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
} as const;
// A fresh key with no balance at all: the assistant's session key.
const sessionKey = privateKeyToAccount(keccak256(stringToHex("paywarden-test-session-key")));
const out = path.resolve(__dirname, "../../contracts/out");
const artifact = (file: string, name: string) => {
  const j = JSON.parse(readFileSync(path.join(out, `${file}.sol`, `${name}.json`), "utf8"));
  return { abi: j.abi as Abi, bytecode: j.bytecode.object as Hex };
};
const USD = 10n ** 6n;
const salt = `0x${"aa".repeat(32)}` as Hex;
const payees = [{ name: "Ada Lovelace", salt }];

describe.skipIf(!anvilBin)("agent through an ERC-4337 smart account (local anvil)", () => {
  let proc: ChildProcess;
  const pub = createPublicClient({ chain, transport: http() });
  const test = createTestClient({ chain, mode: "anvil", transport: http() });
  const wallet = (k: Hex) => createWalletClient({ chain, account: privateKeyToAccount(k), transport: http() });
  const relayerAccount = privateKeyToAccount(keys.relayer);
  let vault: Address;
  let smartAccount: Address;
  const deps = () => ({ pub, relayer: wallet(keys.relayer), relayerAccount, sessionKey, smartAccount, vault, baseMs: 1 });

  beforeAll(async () => {
    proc = spawn(anvilBin!, ["--port", String(PORT), "--silent"], { shell: process.platform === "win32" });
    for (let i = 0; i < 50; i++) {
      try { await pub.getChainId(); break; } catch { await new Promise((r) => setTimeout(r, 200)); }
    }
    const epCode = readFileSync(path.resolve(__dirname, "../../contracts/test/fixtures/EntryPointV07.hex"), "utf8").trim() as Hex;
    await test.setCode({ address: ENTRY_POINT_V07, bytecode: epCode });
    for (const k of Object.values(keys)) await test.setBalance({ address: privateKeyToAccount(k).address, value: 10n ** 20n });

    const owner = wallet(keys.owner);
    const send = async (hash: Promise<Hex>) => pub.waitForTransactionReceipt({ hash: await hash });
    const deploy = async (file: string, name: string, args: unknown[] = []) => {
      const a = artifact(file, name);
      return (await send(owner.deployContract({ abi: a.abi, bytecode: a.bytecode, args }))).contractAddress as Address;
    };
    const token = await deploy("Base.t", "MockUSD8");
    const registry = await deploy("IdentityRegistry", "IdentityRegistry");
    const factory = await deploy("PayrollVaultFactory", "PayrollVaultFactory", [token, registry]);
    const fAbi = artifact("PayrollVaultFactory", "PayrollVaultFactory").abi;
    const rc = await send(owner.writeContract({ address: factory, abi: fAbi, functionName: "createVault", args: [0n] }));
    const created = parseEventLogs({ abi: fAbi, logs: rc.logs, eventName: "VaultCreated" })[0]!.args as { vault: Address; policy: Address };
    vault = created.vault;

    // The employer's smart account, with the assistant's session key scoped to this vault.
    const accountFactory = await deploy("AgentAccountFactory", "AgentAccountFactory", [ENTRY_POINT_V07]);
    const afAbi = artifact("AgentAccountFactory", "AgentAccountFactory").abi;
    const arc = await send(owner.writeContract({ address: accountFactory, abi: afAbi, functionName: "createAccount", args: [owner.account.address, 1n] }));
    smartAccount = (parseEventLogs({ abi: afAbi, logs: arc.logs, eventName: "AccountCreated" })[0]!.args as { account: Address }).account;
    const aAbi = artifact("AgentAccount", "AgentAccount").abi;
    const now = Number((await pub.getBlock()).timestamp);
    await send(owner.writeContract({ address: smartAccount, abi: aAbi, functionName: "setSessionKey", args: [sessionKey.address, vault, now + 86_400, 100_000_000_000n] }));
    await send(owner.writeContract({ address: smartAccount, abi: aAbi, functionName: "addDeposit", value: 10n ** 18n }));

    const pAbi = artifact("AgentSpendPolicy", "AgentSpendPolicy").abi;
    await send(owner.writeContract({
      address: created.policy, abi: pAbi, functionName: "setPolicy",
      args: [{ agent: smartAccount, perRun: 5_000n * USD, perPayee: 3_000n * USD, periodCap: 8_000n * USD, period: 86_400n, expiry: BigInt(now + 86_400 * 30) }],
    }));
    const vAbi = artifact("PayrollVault", "PayrollVault").abi;
    await send(owner.writeContract({ address: vault, abi: vAbi, functionName: "invitePayee", args: [payeeIdOf("Ada Lovelace", salt), "0x0000000000000000000000000000000000000000"] }));
    await send(wallet(keys.ada).writeContract({ address: vault, abi: vAbi, functionName: "confirmPayee", args: ["Ada Lovelace", salt] }));
  }, 60_000);

  afterAll(() => { proc?.kill(); });

  const memoOf = (m: string) => keccak256(stringToHex(m));
  const sheet = async (memo: string, amount: string) => {
    const signature = await privateKeyToAccount(keys.ada).signTypedData(
      payLineTypedData(vault, chain.id, payeeIdOf("Ada Lovelace", salt), toUnits(amount, 6), memoOf(memo)),
    );
    return validateSigned({ memo, lines: [{ name: "Ada Lovelace", amount, signature }] }, payees, {
      vault,
      chainId: chain.id,
      wallet: (id: Hex) => pub.readContract({ address: vault, abi: vaultAbi, functionName: "payeeWallet", args: [id] }),
      verifyTypedData: (a: Parameters<typeof pub.verifyTypedData>[0]) => pub.verifyTypedData(a),
    });
  };

  it("proposes a signed run through the EntryPoint; the session key spends nothing", async () => {
    const r = await submitRunViaAccount(deps(), await sheet("Week 1", "25"));
    expect(r.status).toBe("proposed");
    expect(await pub.getBalance({ address: sessionKey.address })).toBe(0n);
    const again = await submitRunViaAccount(deps(), await sheet("Week 1", "25"));
    expect(again.status).toBe("already-proposed");
  });

  it("the spend policy still caps the account: over the per-person limit is refused", async () => {
    const r = await submitRunViaAccount(deps(), await sheet("Week 2", "3500"));
    expect(r).toMatchObject({ status: "refused", errorName: "PerPayeeCapExceeded" });
  });

  it("the session key cannot do anything but propose (AA24)", async () => {
    const approve = encodeFunctionData({ abi: parseAbi(["function approveRun(bytes32)"]), functionName: "approveRun", args: [memoOf("x")] });
    const { op } = await buildProposeOp(deps(), approve);
    await expect(
      wallet(keys.relayer).writeContract({ address: ENTRY_POINT_V07, abi: entryPointAbi, functionName: "handleOps", args: [[op], relayerAccount.address] }),
    ).rejects.toThrow(/AA24/);
  });

  it("an expired session key is refused by the EntryPoint (AA22)", async () => {
    await test.increaseTime({ seconds: 2 * 86_400 });
    await test.mine({ blocks: 1 });
    const r = await submitRunViaAccount(deps(), await sheet("Week 3", "5"));
    expect(r).toMatchObject({ status: "refused", errorName: "EntryPointAA22" });
  });
});
