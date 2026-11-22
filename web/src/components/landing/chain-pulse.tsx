"use client";

import { useBlockNumber } from "wagmi";
import { ExternalLink } from "lucide-react";
import { aevum, addressUrl } from "@/lib/chain";
import { ADDRESSES } from "@/lib/contracts";

const CONTRACTS = [
  ["Payroll vault factory", ADDRESSES.factory, true],
  ["Identity registry (ERC-8004)", ADDRESSES.identityRegistry, true],
  ["tUSD8 stablecoin (QDay)", ADDRESSES.tusd8, false],
] as const;

/** Live proof the product runs on Aevum: the current block plus verified contract links. */
export function ChainPulse() {
  const { data: block, isError } = useBlockNumber({ chainId: aevum.id, watch: true, query: { refetchInterval: 4_000 } });

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_1.4fr] md:items-end">
      <div>
        <p className="flex items-center gap-2 text-[14px] text-[var(--ink)]/60">
          <span className="relative flex size-2" aria-hidden>
            {!isError && <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--signed)] opacity-60 motion-reduce:hidden" />}
            <span className={`relative inline-flex size-2 rounded-full ${isError ? "bg-[var(--ink)]/30" : "bg-[var(--signed)]"}`} />
          </span>
          {isError ? "Aevum testnet, reconnecting" : "Live on Aevum testnet"}
        </p>
        <p className="tnum mt-2 font-serif text-[clamp(40px,6vw,64px)] leading-none" aria-live="off">
          {block !== undefined ? `#${block.toLocaleString("en-US")}` : "#—"}
        </p>
        <p className="mt-2 text-[14px] text-[var(--ink)]/55">Latest block, updating every few seconds</p>
      </div>

      <ul className="divide-y divide-[var(--ink)]/10 border-y border-[var(--ink)]/10">
        {CONTRACTS.map(([label, addr, ours]) => (
          <li key={addr}>
            <a
              href={addressUrl(addr)}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center justify-between gap-4 py-3.5 transition-colors hover:text-[var(--forest-900)] focus-visible:outline-2 focus-visible:outline-[var(--forest-900)]"
            >
              <span className="text-[15px]">{label}</span>
              <span className="flex items-center gap-2 font-mono text-[12px] text-[var(--ink)]/55 group-hover:text-[var(--forest-900)]">
                {addr.slice(0, 6)}…{addr.slice(-4)}
                {ours && <span className="rounded-full bg-[var(--signed)]/10 px-2 py-0.5 text-[var(--signed)]">Verified</span>}
                <ExternalLink className="size-3.5" aria-hidden />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
