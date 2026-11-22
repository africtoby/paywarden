"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import type { Abi, Address, Hash } from "viem";
import { txUrl } from "./chain";
import { explainError } from "./errors";

export type TxRequest = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
};

/**
 * Sends one contract write with the full toast story: pending, confirmed (with explorer link),
 * or failed (with a plain-English reason). The call is simulated as the connected wallet first,
 * so a contract refusal shows its reason before the wallet is even opened.
 * Resolves to the transaction hash, or null when the transaction did not go through.
 */
export function useTx() {
  const client = usePublicClient();
  const { address: account } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const qc = useQueryClient();

  return useCallback(
    async (label: string, req: TxRequest): Promise<Hash | null> => {
      const id = toast.loading(`${label}: confirm in your wallet`);
      try {
        if (!client || !account) throw new Error("Connect your wallet first.");
        await client.simulateContract({ ...req, account } as never);
        const hash = await writeContractAsync(req as never);
        const view = { label: "View", onClick: () => window.open(txUrl(hash), "_blank") };
        toast.loading(`${label}: waiting for confirmation`, { id, action: view });
        const receipt = await client.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("The transaction was reverted.");
        toast.success(`${label}: confirmed`, { id, action: view });
        // Refresh in the background: callers get the hash as soon as the receipt is in.
        void qc.invalidateQueries();
        return hash;
      } catch (e) {
        toast.error(`${label} failed`, { id, description: explainError(e) });
        return null;
      }
    },
    [client, account, writeContractAsync, qc],
  );
}
