import type { Account, Address, Hex, PublicClient, WalletClient } from "viem";
import { vaultAbi } from "./abi.js";
import { explain, isRetryable } from "./errors.js";
import type { SignedProposal } from "./validate.js";

export async function withRetry<T>(fn: () => Promise<T>, tries = 4, baseMs = 500): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!isRetryable(e) || i >= tries - 1) throw e;
      await new Promise((r) => setTimeout(r, baseMs * 2 ** i));
    }
  }
}

export type Outcome =
  | { status: "proposed"; txHash: Hex }
  | { status: "already-proposed" }
  | { status: "refused"; errorName: string; message: string };

/**
 * Simulate first (a refusal costs no gas), send, then wait for the receipt.
 * Contract refusals are returned, not thrown. DuplicateRun counts as success: nothing new was created.
 */
export async function submitRun(
  deps: { pub: PublicClient; wallet: WalletClient; account: Account; vault: Address; baseMs?: number },
  p: SignedProposal,
): Promise<Outcome> {
  const args = [p.payeeIds, p.amounts, p.memoHash, p.signatures] as const;
  const lines = p.lines.map((l, i) => ({ payeeId: p.payeeIds[i]!, name: l.name, amount: l.amount }));
  try {
    const { request } = await withRetry(
      () =>
        deps.pub.simulateContract({
          address: deps.vault,
          abi: vaultAbi,
          functionName: "proposeRun",
          args,
          account: deps.account,
        }),
      4,
      deps.baseMs,
    );
    const txHash = await withRetry(() => deps.wallet.writeContract(request), 4, deps.baseMs);
    const receipt = await withRetry(() => deps.pub.waitForTransactionReceipt({ hash: txHash }), 4, deps.baseMs);
    if (receipt.status !== "success") {
      return { status: "refused", errorName: "Reverted", message: "The transaction reverted on chain." };
    }
    return { status: "proposed", txHash };
  } catch (e) {
    const x = explain(e, lines);
    if (x.name === "DuplicateRun") return { status: "already-proposed" };
    if (x.name !== "Unknown") return { status: "refused", errorName: x.name, message: x.message };
    throw e;
  }
}
