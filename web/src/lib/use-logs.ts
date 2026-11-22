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

// The Aevum RPC refuses getLogs over 1,000 blocks, so the fallback walks forward in windows of that size.
const CHUNK = 1_000n;
const PARALLEL = 8;

const created = new Map<string, bigint>();

/** First block where the contract has code, by bisection (needs a node that serves old state). Remembered per vault. */
async function creationBlock(client: NonNullable<ReturnType<typeof usePublicClient>>, vault: Address, latest: bigint): Promise<bigint> {
  const key = `paywarden:created:${vault.toLowerCase()}`;
  const known = created.get(vault);
  if (known !== undefined) return known;
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      created.set(vault, BigInt(saved));
      return BigInt(saved);
    }
  } catch {
    /* no storage: bisect again next time */
  }
  let lo = 0n;
  let hi = latest;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    const code = await client.getCode({ address: vault, blockNumber: mid });
    if (code && code !== "0x") hi = mid;
    else lo = mid + 1n;
  }
  created.set(vault, lo);
  try {
    localStorage.setItem(key, lo.toString());
  } catch {
    /* ignore */
  }
  return lo;
}

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
        const first = await creationBlock(client!, vault!, latest);
        const windows: [bigint, bigint][] = [];
        for (let from = first; from <= latest; from += CHUNK) windows.push([from, from + CHUNK - 1n < latest ? from + CHUNK - 1n : latest]);
        logs = [];
        for (let i = 0; i < windows.length; i += PARALLEL) {
          const parts = await Promise.all(windows.slice(i, i + PARALLEL).map(([f, t]) => client!.getLogs({ address, fromBlock: f, toBlock: t })));
          logs = [...logs, ...parts.flat()];
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
