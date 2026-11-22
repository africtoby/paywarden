"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import type { Address } from "viem";
import { ADDRESSES, agentSpendPolicyAbi, erc20Abi, payrollVaultAbi, payrollVaultFactoryAbi } from "./contracts";

export type PolicyView = {
  agent: Address;
  perRun: bigint;
  perPayee: bigint;
  periodCap: bigint;
  period: bigint;
  expiry: bigint;
};

/** The connected wallet's (first) vault plus everything the pages need to show about it. */
export function useVault() {
  const { address, isConnected } = useAccount();

  const vaults = useReadContract({
    address: ADDRESSES.factory,
    abi: payrollVaultFactoryAbi,
    functionName: "vaultsOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const vault = vaults.data?.[0] as Address | undefined;

  const policyAddr = useReadContract({
    address: vault,
    abi: payrollVaultAbi,
    functionName: "policy",
    query: { enabled: !!vault },
  });
  const policy = policyAddr.data as Address | undefined;

  const state = useReadContracts({
    allowFailure: false,
    query: { enabled: !!vault && !!policy, refetchInterval: 10_000 },
    contracts: vault && policy
      ? [
          { address: ADDRESSES.tusd8, abi: erc20Abi, functionName: "balanceOf", args: [vault] },
          { address: vault, abi: payrollVaultAbi, functionName: "paused" },
          { address: vault, abi: payrollVaultAbi, functionName: "reviewWindow" },
          { address: policy, abi: agentSpendPolicyAbi, functionName: "policy" },
          { address: policy, abi: agentSpendPolicyAbi, functionName: "revoked" },
          { address: policy, abi: agentSpendPolicyAbi, functionName: "remainingInPeriod" },
        ]
      : [],
  });

  const d = state.data as unknown as [bigint, boolean, bigint, readonly [Address, bigint, bigint, bigint, bigint, bigint], boolean, bigint] | undefined;
  const p = d?.[3];

  return {
    address,
    isConnected,
    vault,
    policyAddress: policy,
    hasVault: !!vault,
    loading: vaults.isLoading || policyAddr.isLoading || state.isLoading,
    balance: d?.[0],
    paused: d?.[1],
    reviewWindow: d ? Number(d[2]) : undefined,
    policy: p
      ? ({ agent: p[0], perRun: p[1], perPayee: p[2], periodCap: p[3], period: p[4], expiry: p[5] } satisfies PolicyView)
      : undefined,
    revoked: d?.[4],
    remaining: d?.[5],
  };
}
