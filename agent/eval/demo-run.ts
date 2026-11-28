/**
 * One full payday with worker-signed pay lines on Aevum testnet, for the README's on-chain proof table.
 * Uses the real agent CLI for the honest proposal. Test wallets only (DEPLOYER_PRIVATE_KEY = owner, AGENT_PRIVATE_KEY = assistant).
 *
 *   npx tsx eval/demo-run.ts
 */
import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BaseError, createPublicClient, createWalletClient, decodeErrorResult, defineChain, encodeAbiParameters, encodeFunctionData,
  http, keccak256, parseAbi, parseEther, stringToHex, type Abi, type Address, type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { payeeIdOf, payLineTypedData } from "../src/validate.js";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..", "..");
loadEnv({ path: resolve(ROOT, ".env") });

const FACTORY = "0xfaC8ebb7D8f494618068B7eF86FF9A0767b34209" as Address;
const TUSD8 = "0x456569838f1d43009A91ebA4263147Afd7233483" as Address;
const RPC = process.env.RPC_URL ?? "https://rpc-test.qday.info";
const USD = 1_000_000n;
const GAS = 600_000n;

const artifact = (file: string, name: string) => JSON.parse(readFileSync(resolve(ROOT, "contracts", "out", file, `${name}.json`), "utf8")).abi as Abi;
const vaultAbi = artifact("PayrollVault.sol", "PayrollVault");
const policyAbi = artifact("AgentSpendPolicy.sol", "AgentSpendPolicy");
const factoryAbi = artifact("PayrollVaultFactory.sol", "PayrollVaultFactory");
const erc20Abi = parseAbi(["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"]) as Abi;
const errorAbi = [...vaultAbi, ...policyAbi].filter((x) => x.type === "error") as Abi;

const chain = defineChain({ id: 44005, name: "Aevum", nativeCurrency: { name: "tQDAY", symbol: "tQDAY", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const pub = createPublicClient({ chain, transport: http(RPC, { retryCount: 4 }) });
const wallets = new Map<string, ReturnType<typeof createWalletClient>>();
const walletOf = (a: PrivateKeyAccount) => {
  if (!wallets.has(a.address)) wallets.set(a.address, createWalletClient({ chain, account: a, transport: http(RPC, { retryCount: 4 }) }));
  return wallets.get(a.address)!;
};
const need = (n: string) => { const v = process.env[n]; if (!v) throw new Error(`Missing ${n}`); return v as Hex; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const proof: Record<string, string> = {};

function errorName(e: unknown): string {
  let data: Hex | undefined;
  if (e instanceof BaseError) e.walk((x) => {
    const d = (x as { data?: unknown }).data;
    if (typeof d === "string" && d.startsWith("0x") && d.length >= 10) data = d as Hex;
    else if (d && typeof d === "object" && typeof (d as { data?: unknown }).data === "string") data = (d as { data: Hex }).data;
    return false;
  });
  if (!data) return "Unknown";
  try { return decodeErrorResult({ abi: errorAbi, data }).errorName; } catch { return `Unknown (${data.slice(0, 10)})`; }
}

async function ok(label: string, acct: PrivateKeyAccount, to: Address, abi: Abi, functionName: string, args: unknown[] = []) {
  const data = encodeFunctionData({ abi, functionName, args } as never);
  const hash = await walletOf(acct).sendTransaction({ account: acct, chain, to, data } as never);
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${label} reverted: ${hash}`);
  proof[label] = hash;
  console.log(`ok       ${label}  ${hash}`);
  return hash;
}

/** Sends a call that must be refused: fixed gas so it lands on-chain as a failed tx, then names the error by re-running one block earlier. */
async function refused(label: string, expected: string, acct: PrivateKeyAccount, to: Address, abi: Abi, functionName: string, args: unknown[]) {
  const data = encodeFunctionData({ abi, functionName, args } as never);
  const hash = await walletOf(acct).sendTransaction({ account: acct, chain, to, data, gas: GAS } as never);
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status === "success") throw new Error(`STOP: "${label}" was ALLOWED (${hash})`);
  let actual = "?";
  try { await pub.call({ account: acct.address, to, data, blockNumber: r.blockNumber - 1n }); } catch (e) { actual = errorName(e); }
  proof[`REFUSED ${label} (${actual})`] = hash;
  console.log(`${actual === expected ? "refused " : "WRONG   "} ${label} -> ${actual}  ${hash}`);
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

async function main() {
  if ((await pub.getChainId()) !== 44005) throw new Error("Not the Aevum testnet");
  const owner = privateKeyToAccount(need("DEPLOYER_PRIVATE_KEY"));
  const agent = privateKeyToAccount(need("AGENT_PRIVATE_KEY"));
  const ada = privateKeyToAccount(generatePrivateKey());
  const attacker = privateKeyToAccount(generatePrivateKey());
  for (const w of [ada, attacker]) {
    const hash = await walletOf(owner).sendTransaction({ account: owner, chain, to: w.address, value: parseEther("0.01") } as never);
    await pub.waitForTransactionReceipt({ hash });
  }

  await ok("Create vault (60 s review window)", owner, FACTORY, factoryAbi, "createVault", [60n]);
  const mine = (await pub.readContract({ address: FACTORY, abi: factoryAbi, functionName: "vaultsOf", args: [owner.address] })) as Address[];
  const vault = mine[mine.length - 1]!;
  const policy = (await pub.readContract({ address: vault, abi: vaultAbi, functionName: "policy" })) as Address;
  console.log(`vault ${vault}\npolicy ${policy}\nada ${ada.address}\nattacker ${attacker.address}`);

  await ok("Approve $0.50", owner, TUSD8, erc20Abi, "approve", [vault, USD / 2n]);
  await ok("Deposit $0.50", owner, vault, vaultAbi, "deposit", [USD / 2n]);
  const now = BigInt(Math.floor(Date.now() / 1000));
  await ok("Set the assistant's limits", owner, policy, policyAbi, "setPolicy", [{ agent: agent.address, perRun: 3n * USD, perPayee: 800_000n, periodCap: 10n * USD, period: 7n * 86400n, expiry: now + 90n * 86400n }]);
  await ok("Register the assistant's identity", owner, vault, vaultAbi, "registerAgentIdentity");

  const salt = keccak256(stringToHex(`demo:${vault}:${now}`));
  const id = payeeIdOf("Ada", salt);
  await ok("Invite Ada, bound to her wallet", owner, vault, vaultAbi, "invitePayee", [id, ada.address]);
  await refused("another wallet confirms with Ada's secret", "UnexpectedWallet", attacker, vault, vaultAbi, "confirmPayee", ["Ada", salt]);
  await ok("Ada confirms from her own wallet", ada, vault, vaultAbi, "confirmPayee", ["Ada", salt]);

  const memo = "demo week 1";
  const memoHash = keccak256(stringToHex(memo));
  const sign = (who: PrivateKeyAccount, amt: bigint, m = memoHash) => who.signTypedData(payLineTypedData(vault, 44005, id, amt, m));
  const adaSig = await sign(ada, 500_000n);
  proof["Ada's signature (off-chain, no gas)"] = adaSig;
  console.log(`ada signed $0.50  ${adaSig.slice(0, 20)}…`);

  // The real agent CLI proposes the signed sheet.
  const dir = mkdtempSync(join(tmpdir(), "paywarden-demo-"));
  writeFileSync(join(dir, "sheet.json"), JSON.stringify({ memo, lines: [{ name: "Ada", amount: "0.50", signature: adaSig }] }));
  writeFileSync(join(dir, "payees.json"), JSON.stringify([{ name: "Ada", salt }]));
  const out = execFileSync("npx", ["tsx", "src/cli.ts", join(dir, "sheet.json"), join(dir, "payees.json")], {
    cwd: resolve(here, ".."), env: { ...process.env, VAULT_ADDRESS: vault, USE_LLM_PARSER: "false" }, encoding: "utf8", shell: true,
  });
  console.log(out.trim());
  const proposeTx = /Tx (0x[0-9a-fA-F]{64})/.exec(out)?.[1];
  if (!proposeTx) throw new Error("Agent CLI did not report a transaction");
  proof["Assistant drafts Ada's $0.50 run (agent CLI)"] = proposeTx;

  // Forced on-chain, so the refusals are recorded.
  const forgedMemo = keccak256(stringToHex("demo forged"));
  await refused("a line signed by the wrong key", "InvalidWorkerSignature", agent, vault, vaultAbi, "proposeRun", [[id], [300_000n], forgedMemo, [await sign(attacker, 300_000n, forgedMemo)]]);
  await refused("a line with no signature at all", "InvalidWorkerSignature", agent, vault, vaultAbi, "proposeRun", [[id], [300_000n], keccak256(stringToHex("demo unsigned")), ["0x"]]);

  const runKey = keccak256(encodeAbiParameters([{ type: "bytes32[]" }, { type: "uint256[]" }, { type: "bytes32" }], [[id], [500_000n], memoHash]));
  await ok("Owner approves", owner, vault, vaultAbi, "approveRun", [runKey]);
  const run = (await pub.readContract({ address: vault, abi: vaultAbi, functionName: "getRun", args: [runKey] })) as { executableAt: bigint };
  const wait = Number(run.executableAt) * 1000 - Date.now() + 8000;
  if (wait > 0) { console.log(`waiting ${Math.ceil(wait / 1000)} s for the review window`); await sleep(wait); }
  await ok("Owner signs and pays: $0.50 to Ada", owner, vault, vaultAbi, "executeRun", [runKey]);
  console.log("Ada balance", await pub.readContract({ address: TUSD8, abi: erc20Abi, functionName: "balanceOf", args: [ada.address] }));

  await refused("Ada's same signed line drafted again (LineAlreadyPaid)", "LineAlreadyPaid", agent, vault, vaultAbi, "proposeRun", [[id], [500_000n], memoHash, [adaSig]]);

  await ok("Owner switches the assistant off", owner, policy, policyAbi, "revoke");
  await refused("the assistant tries to draft after the switch-off", "PolicyRevoked", agent, vault, vaultAbi, "proposeRun", [[id], [100_000n], keccak256(stringToHex("demo after")), [await sign(ada, 100_000n, keccak256(stringToHex("demo after")))]]);

  const result = { date: new Date().toISOString().slice(0, 10), vault, policy, ada: ada.address, attacker: attacker.address, proof };
  writeFileSync(join(dir, "demo-result.json"), JSON.stringify(result, null, 2));
  console.log(`\nRESULT_FILE ${join(dir, "demo-result.json")}\n${JSON.stringify(result, null, 2)}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
