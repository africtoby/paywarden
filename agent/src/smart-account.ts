import {
  BaseError,
  ContractFunctionRevertedError,
  concat,
  decodeErrorResult,
  encodeFunctionData,
  pad,
  parseAbi,
  parseEventLogs,
  toHex,
  type Account,
  type Address,
  type Hex,
  type LocalAccount,
  type PublicClient,
  type WalletClient,
} from "viem";
import { vaultAbi } from "./abi.js";
import { explain } from "./errors.js";
import { withRetry, type Outcome } from "./submit.js";
import type { SignedProposal } from "./validate.js";

/** The canonical ERC-4337 EntryPoint v0.7. The same code is deployed on Aevum testnet. */
export const ENTRY_POINT_V07: Address = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

const OP = "(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)";

export const entryPointAbi = parseAbi([
  `function handleOps(${OP}[] ops, address beneficiary)`,
  `function getUserOpHash(${OP} userOp) view returns (bytes32)`,
  "function getNonce(address sender, uint192 key) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "error FailedOp(uint256 opIndex, string reason)",
  "error FailedOpWithRevert(uint256 opIndex, string reason, bytes inner)",
  "event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)",
  "event UserOperationRevertReason(bytes32 indexed userOpHash, address indexed sender, uint256 nonce, bytes revertReason)",
]);

export const agentAccountAbi = parseAbi([
  "function execute(address target, uint256 value, bytes data)",
  "function sessionKey() view returns (address)",
  "function sessionVault() view returns (address)",
  "function sessionValidUntil() view returns (uint48)",
  "function getDeposit() view returns (uint256)",
]);

export type UserOp = {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  accountGasLimits: Hex;
  preVerificationGas: bigint;
  gasFees: Hex;
  paymasterAndData: Hex;
  signature: Hex;
};

/** Two 128-bit values packed into one word, high then low (v0.7 accountGasLimits and gasFees). */
export const pack128 = (high: bigint, low: bigint): Hex => concat([pad(toHex(high), { size: 16 }), pad(toHex(low), { size: 16 })]);

/** EntryPoint "AAxx" codes -> plain English. */
export function explainEntryPoint(reason: string): { name: string; message: string } {
  const code = reason.slice(0, 4);
  const text: Record<string, string> = {
    AA22: "The assistant's session key has expired. The owner can set a new one on the smart account.",
    AA24: "The assistant's session key may only draft runs on this vault, and this was something else (or the key was revoked).",
    AA25: "This user operation was already used (nonce).",
    AA21: "The smart account's gas deposit is too low. The owner can top it up.",
    AA23: "The smart account refused the operation.",
  };
  return { name: `EntryPoint${code}`, message: text[code] ?? `The EntryPoint refused the operation (${reason}).` };
}

function entryPointRefusal(err: unknown): { name: string; message: string } | undefined {
  if (!(err instanceof BaseError)) return undefined;
  const r = err.walk((e) => e instanceof ContractFunctionRevertedError);
  if (r instanceof ContractFunctionRevertedError && r.data && r.data.errorName.startsWith("FailedOp")) {
    return explainEntryPoint(String((r.data.args as readonly unknown[])[1]));
  }
  return undefined;
}

export type AccountDeps = {
  pub: PublicClient;
  /** Any funded key that submits handleOps; the EntryPoint refunds its gas from the account's deposit. */
  relayer: WalletClient;
  relayerAccount: Account;
  /** The assistant's session key: no funds, no gas, only allowed to propose. */
  sessionKey: LocalAccount;
  smartAccount: Address;
  vault: Address;
  entryPoint?: Address;
  baseMs?: number;
  /** Fixed gas for handleOps. Set it to record a refusal on-chain instead of stopping at the simulation. */
  forceGas?: bigint;
};

/** On a refusal that reached the chain (forceGas), `onChainTx` is the failed handleOps transaction. */
export type AccountOutcome = Outcome & { userOpHash?: Hex; onChainTx?: Hex };

/** Builds and signs a v0.7 user operation for execute(vault, 0, proposeRun(...)). */
export async function buildProposeOp(deps: AccountDeps, innerData: Hex, target: Address = deps.vault): Promise<{ op: UserOp; hash: Hex }> {
  const ep = deps.entryPoint ?? ENTRY_POINT_V07;
  const callData = encodeFunctionData({ abi: agentAccountAbi, functionName: "execute", args: [target, 0n, innerData] });
  const [nonce, gasPrice] = await Promise.all([
    withRetry(() => deps.pub.readContract({ address: ep, abi: entryPointAbi, functionName: "getNonce", args: [deps.smartAccount, 0n] }), 4, deps.baseMs),
    withRetry(() => deps.pub.getGasPrice(), 4, deps.baseMs),
  ]);
  let callGas = 400_000n;
  try {
    callGas = ((await deps.pub.estimateGas({ account: deps.smartAccount, to: target, data: innerData })) * 3n) / 2n + 50_000n;
  } catch {
    // A refusal is caught by the simulation in submitRunViaAccount; a forced op keeps the default.
  }
  const fee = (gasPrice * 12n) / 10n;
  const op: UserOp = {
    sender: deps.smartAccount,
    nonce,
    initCode: "0x",
    callData,
    accountGasLimits: pack128(150_000n, callGas),
    preVerificationGas: 60_000n,
    gasFees: pack128(fee, fee),
    paymasterAndData: "0x",
    signature: "0x",
  };
  const hash = await deps.pub.readContract({ address: ep, abi: entryPointAbi, functionName: "getUserOpHash", args: [op] });
  op.signature = await deps.sessionKey.signMessage({ message: { raw: hash } });
  return { op, hash };
}

/**
 * Same contract as submitRun, but through the employer's ERC-4337 smart account:
 * simulate the proposal as the account, sign a user operation with the session key,
 * hand it to the EntryPoint from the relayer, then read the UserOperationEvent.
 */
export async function submitRunViaAccount(deps: AccountDeps, p: SignedProposal): Promise<AccountOutcome> {
  const ep = deps.entryPoint ?? ENTRY_POINT_V07;
  const args = [p.payeeIds, p.amounts, p.memoHash, p.signatures] as const;
  const lines = p.lines.map((l, i) => ({ payeeId: p.payeeIds[i]!, name: l.name, amount: l.amount }));
  const inner = encodeFunctionData({ abi: vaultAbi, functionName: "proposeRun", args });

  if (!deps.forceGas) {
    try {
      await withRetry(
        () => deps.pub.simulateContract({ address: deps.vault, abi: vaultAbi, functionName: "proposeRun", args, account: deps.smartAccount }),
        4,
        deps.baseMs,
      );
    } catch (e) {
      const x = explain(e, lines);
      if (x.name === "DuplicateRun") return { status: "already-proposed" };
      if (x.name !== "Unknown") return { status: "refused", errorName: x.name, message: x.message };
      throw e;
    }
  }

  const { op, hash } = await buildProposeOp(deps, inner);
  try {
    const txHash = await withRetry(
      () =>
        deps.relayer.writeContract({
          address: ep,
          abi: entryPointAbi,
          functionName: "handleOps",
          args: [[op], deps.relayerAccount.address],
          account: deps.relayerAccount,
          chain: deps.relayer.chain,
          ...(deps.forceGas ? { gas: deps.forceGas } : {}),
        }),
      4,
      deps.baseMs,
    );
    const receipt = await withRetry(() => deps.pub.waitForTransactionReceipt({ hash: txHash }), 4, deps.baseMs);
    if (receipt.status !== "success") {
      let name = "Reverted";
      let message = "The EntryPoint refused the operation on chain.";
      try {
        await deps.pub.simulateContract({ address: ep, abi: entryPointAbi, functionName: "handleOps", args: [[op], deps.relayerAccount.address], account: deps.relayerAccount, blockNumber: receipt.blockNumber - 1n });
      } catch (e) {
        const x = entryPointRefusal(e);
        if (x) ({ name, message } = x);
      }
      return { status: "refused", errorName: name, message, userOpHash: hash, onChainTx: txHash };
    }
    const ev = parseEventLogs({ abi: entryPointAbi, logs: receipt.logs, eventName: "UserOperationEvent" })[0];
    if (ev && !ev.args.success) {
      const why = parseEventLogs({ abi: entryPointAbi, logs: receipt.logs, eventName: "UserOperationRevertReason" })[0];
      let name = "Reverted";
      try {
        if (why) name = decodeErrorResult({ abi: vaultAbi, data: why.args.revertReason }).errorName;
      } catch {
        // unknown revert data
      }
      return { status: "refused", errorName: name, message: `The vault refused the run inside the user operation (${name}).`, userOpHash: hash };
    }
    return { status: "proposed", txHash, userOpHash: hash };
  } catch (e) {
    const x = entryPointRefusal(e);
    if (x) return { status: "refused", errorName: x.name, message: x.message, userOpHash: hash };
    throw e;
  }
}
