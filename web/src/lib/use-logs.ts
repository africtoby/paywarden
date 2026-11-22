"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { decodeEventLog, type Address, type Hex } from "viem";
import { agentSpendPolicyAbi, payrollVaultAbi } from "./contracts";

export type VaultEvent = {
  name: string;
  args: Record<string, unknown>;
  txHash: Hex;
  blockNumber: bigint;
  logIndex: number;
  /** Unix seconds. */
  timestamp: number;
};

const CHUNK = 50_000n;

/** All events emitted by a vault and its policy, oldest first, decoded and timestamped. */
export function useVaultEvents(vault?: Address, policy?: Address) {
  const client = usePublicClient();

  return useQuery({
    queryKey: ["vault-events", vault, policy],
    enabled: !!client && !!vault && !!policy,
    refetchInterval: 15_000,
    queryFn: async (): Promise<VaultEvent[]> => {
      const address = [vault!, policy!];
      const latest = await client!.getBlockNumber();

      // Try one request; some RPCs cap the range, so fall back to chunks.
      let logs: Awaited<ReturnType<NonNullable<typeof client>["getLogs"]>> = [];
      try {
        logs = await client!.getLogs({ address, fromBlock: 0n, toBlock: latest });
      } catch {
        for (let from = latest; from >= 0n; from -= CHUNK) {
          const start = from >= CHUNK ? from - CHUNK + 1n : 0n;
          const part = await client!.getLogs({ address, fromBlock: start, toBlock: from });
          logs = [...part, ...logs];
          if (start === 0n) break;
        }
      }

      const decoded = logs.flatMap((l) => {
        for (const abi of [payrollVaultAbi, agentSpendPolicyAbi]) {
          try {
            const e = decodeEventLog({ abi, data: l.data, topics: l.topics });
            return [{ e, l }];
          } catch {
            /* try the next ABI */
          }
        }
        return [];
      });

      const blocks = [...new Set(decoded.map(({ l }) => l.blockNumber!))];
      const times = new Map<bigint, number>();
      await Promise.all(
        blocks.map(async (n) => {
          const b = await client!.getBlock({ blockNumber: n });
          times.set(n, Number(b.timestamp));
        }),
      );

      return decoded.map(({ e, l }) => ({
        name: e.eventName as string,
        args: (e.args ?? {}) as Record<string, unknown>,
        txHash: l.transactionHash!,
        blockNumber: l.blockNumber!,
        logIndex: l.logIndex!,
        timestamp: times.get(l.blockNumber!) ?? 0,
      }));
    },
  });
}
