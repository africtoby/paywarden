/**
 * ERC-4337 proof on Aevum testnet: the assistant drafts payroll through the employer's smart account
 * (AgentAccount) with a session key that holds no funds and no gas. Records the honest proposal and
 * two on-chain refusals in docs/account-demo-results.json. Test wallets only.
 *
 *   npx tsx eval/account-demo.ts
 */
import { config as loadEnv } from "dotenv";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient, createWalletClient, defineChain, encodeFunctionData, http, keccak256, parseAbi, parseEther,
  encodeAbiParameters, parseEventLogs, stringToHex, type Abi, type Address, type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { ENTRY_POINT_V07, buildProposeOp, entryPointAbi, submitRunViaAccount } from "../src/smart-account.js";
import { payLineTypedData, payeeIdOf, validateSigned } from "../src/validate.js";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..", "..");
loadEnv({ path: resolve(ROOT, ".env") });

const VAULT_FACTORY = "0xfaC8ebb7D8f494618068B7eF86FF9A0767b34209" as Address;
const ACCOUNT_FACTORY = "0x9F59524dD9002e4A96FAFdd11C0F1A9A7b5809a5" as Address;
const RPC = process.env.RPC_URL ?? "https://rpc-test.qday.info";
const USD = 1_000_000n;
const GAS = 800_000n;

const abiOf = (file: string, name: string) => JSON.parse(readFileSync(resolve(ROOT, "contracts", "out", file, `${name}.json`), "utf8")).abi as Abi;
const vaultAbi = abiOf("PayrollVault.sol", "PayrollVault");
const policyAbi = abiOf("AgentSpendPolicy.sol", "AgentSpendPolicy");
const factoryAbi = abiOf("PayrollVaultFactory.sol", "PayrollVaultFactory");
const accountAbi = abiOf("AgentAccount.sol", "AgentAccount");
const accountFactoryAbi = abiOf("AgentAccountFactory.sol", "AgentAccountFactory");

const chain = defineChain({ id: 44005, name: "Aevum", nativeCurrency: { name: "tQDAY", symbol: "tQDAY", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const pub = createPublicClient({ chain, transport: http(RPC, { retryCount: 4 }) });
const walletOf = (a: PrivateKeyAccount) => createWalletClient({ chain, account: a, transport: http(RPC, { retryCount: 4 }) });
const need = (n: string) => { const v = process.env[n]; if (!v) throw new Error(`Missing ${n}`); return v as Hex; };
const proof: Record<string, string> = {};

async function ok(label: string, acct: PrivateKeyAccount, to: Address, abi: Abi, functionName: string, args: unknown[] = [], value?: bigint) {
  const data = encodeFunctionData({ abi, functionName, args } as never);
  const hash = await walletOf(acct).sendTransaction({ account: acct, chain, to, data, value } as never);
  const r = await pub.waitForTransactionReceipt({ hash });
  if (r.status !== "success") throw new Error(`${label} reverted: ${hash}`);
  proof[label] = hash;
  console.log(`ok       ${label}  ${hash}`);
  return r;
}

async function main() {
  if ((await pub.getChainId()) !== 44005) throw new Error("Not the Aevum testnet");
  const owner = privateKeyToAccount(need("DEPLOYER_PRIVATE_KEY"));
  const session = privateKeyToAccount(generatePrivateKey()); // the assistant's session key: never funded
  const ada = privateKeyToAccount(generatePrivateKey());
  await pub.waitForTransactionReceipt({ hash: await walletOf(owner).sendTransaction({ account: owner, chain, to: ada.address, value: parseEther("0.01") } as never) });

  // 1. A vault, and the employer's smart account from the factory (CREATE2: same owner + salt, same address).
  await ok("Create vault", owner, VAULT_FACTORY, factoryAbi, "createVault", [0n]);
  const mine = (await pub.readContract({ address: VAULT_FACTORY, abi: factoryAbi, functionName: "vaultsOf", args: [owner.address] })) as Address[];
  const vault = mine[mine.length - 1]!;
  const policy = (await pub.readContract({ address: vault, abi: vaultAbi, functionName: "policy" })) as Address;
  const salt = BigInt(Math.floor(Date.now() / 1000));
  const rc = await ok("Create the employer's smart account", owner, ACCOUNT_FACTORY, accountFactoryAbi, "createAccount", [owner.address, salt]);
  const smartAccount = (parseEventLogs({ abi: accountFactoryAbi, logs: rc.logs, eventName: "AccountCreated" })[0]!.args as unknown as { account: Address }).account;
  console.log(`vault ${vault}\npolicy ${policy}\naccount ${smartAccount}\nsession key ${session.address}`);

  // 2. Gas deposit, session key scoped to proposeRun on this vault for 7 days, and the account as the assistant.
  await ok("Deposit gas at the EntryPoint", owner, smartAccount, accountAbi, "addDeposit", [], parseEther("0.05"));
  const now = BigInt(Math.floor(Date.now() / 1000));
  await ok("Give the assistant a session key (proposeRun only, 7 days)", owner, smartAccount, accountAbi, "setSessionKey", [session.address, vault, Number(now + 7n * 86400n)]);
  await ok("Set the smart account as the assistant, with limits", owner, policy, policyAbi, "setPolicy", [{ agent: smartAccount, perRun: 3n * USD, perPayee: 800_000n, periodCap: 10n * USD, period: 7n * 86400n, expiry: now + 90n * 86400n }]);

  // 3. Ada confirms her wallet and signs her line.
  const paySalt = keccak256(stringToHex(`account-demo:${vault}:${now}`));
  const id = payeeIdOf("Ada", paySalt);
  await ok("Invite Ada, bound to her wallet", owner, vault, vaultAbi, "invitePayee", [id, ada.address]);
  await ok("Ada confirms from her own wallet", ada, vault, vaultAbi, "confirmPayee", ["Ada", paySalt]);
  const memo = "Week 49";
  const signature = await ada.signTypedData(payLineTypedData(vault, chain.id, id, USD / 2n, keccak256(stringToHex(memo))));
  const proposal = await validateSigned({ memo, lines: [{ name: "Ada", amount: "0.50", signature }] }, [{ name: "Ada", salt: paySalt }], {
    vault,
    chainId: chain.id,
    wallet: (pid: Hex) => pub.readContract({ address: vault, abi: vaultAbi, functionName: "payeeWallet", args: [pid] }) as Promise<Address>,
    verifyTypedData: (a: Parameters<typeof pub.verifyTypedData>[0]) => pub.verifyTypedData(a),
  });

  const deps = { pub, relayer: walletOf(owner), relayerAccount: owner, sessionKey: session, smartAccount, vault };

  // 4. The honest draft, through the EntryPoint.
  const honest = await submitRunViaAccount(deps, proposal);
  if (honest.status !== "proposed") throw new Error(`Expected proposed, got ${JSON.stringify(honest)}`);
  proof["Assistant proposes Ada's signed $0.50 line through the smart account (handleOps)"] = honest.txHash;
  console.log(`ok       proposed via EntryPoint  ${honest.txHash}`);

  // 5. Refused on-chain: the session key tries to approve the run itself.
  const runKey = keccak256(
    encodeAbiParameters([{ type: "bytes32[]" }, { type: "uint256[]" }, { type: "bytes32" }], [proposal.payeeIds, proposal.amounts, proposal.memoHash]),
  );
  const approve = encodeFunctionData({ abi: parseAbi(["function approveRun(bytes32)"]), functionName: "approveRun", args: [runKey] });
  const { op } = await buildProposeOp(deps, approve);
  const tx1 = await walletOf(owner).writeContract({ address: ENTRY_POINT_V07, abi: entryPointAbi, functionName: "handleOps", args: [[op], owner.address], gas: GAS, account: owner, chain });
  const r1 = await pub.waitForTransactionReceipt({ hash: tx1 });
  if (r1.status === "success") throw new Error(`STOP: approveRun by the session key was ALLOWED (${tx1})`);
  proof["REFUSED session key tries approveRun (AA24 signature error)"] = tx1;
  console.log(`refused  session key approveRun -> AA24  ${tx1}`);

  // 6. Refused on-chain: the owner revokes the session key, the assistant tries again.
  await ok("Owner revokes the session key", owner, smartAccount, accountAbi, "revokeSessionKey");
  const memo2 = "Week 50";
  const sig2 = await ada.signTypedData(payLineTypedData(vault, chain.id, id, USD / 2n, keccak256(stringToHex(memo2))));
  const proposal2 = { ...proposal, memoHash: keccak256(stringToHex(memo2)), signatures: [sig2] as Hex[] };
  const after = await submitRunViaAccount({ ...deps, forceGas: GAS }, proposal2);
  if (after.status !== "refused") throw new Error(`STOP: revoked session key was ALLOWED`);
  if (!after.onChainTx) throw new Error("Expected the refusal to land on-chain");
  const tx2Hash = after.onChainTx;
  proof[`REFUSED revoked session key tries to propose (${after.errorName})`] = tx2Hash;
  console.log(`refused  revoked session key -> ${after.errorName}  ${tx2Hash}`);

  const sessionBalance = await pub.getBalance({ address: session.address });
  const out = { network: "QDay Aevum testnet (44005)", entryPoint: ENTRY_POINT_V07, accountFactory: ACCOUNT_FACTORY, vault, policy, smartAccount, sessionKey: session.address, sessionKeyBalance: sessionBalance.toString(), transactions: proof };
  writeFileSync(resolve(ROOT, "docs", "account-demo-results.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`session key balance: ${sessionBalance} (it never held anything)`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
