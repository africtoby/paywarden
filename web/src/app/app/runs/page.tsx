"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useReadContracts } from "wagmi";
import type { Address, Hex } from "viem";
import { EventTimeline } from "@/components/event-timeline";
import { Seal } from "@/components/seal";
import { SignatureMark } from "@/components/signature-mark";
import { StatusChip, type ChipKind } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { payrollVaultAbi, RUN_STATUS, TOKEN_SYMBOL, type RunStatus } from "@/lib/contracts";
import { txUrl } from "@/lib/chain";
import { formatAmount, formatDuration, shortAddress, shortHash } from "@/lib/format";
import { payeeNames } from "@/lib/payee";
import { checkRun } from "@/lib/run-checks";
import { useVaultEvents, type VaultEvent } from "@/lib/use-logs";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import { useTx } from "@/lib/use-tx";
import { useVault } from "@/lib/use-vault";

type Run = {
  runKey: Hex;
  payeeIds: readonly Hex[];
  amounts: readonly bigint[];
  total: bigint;
  executableAt: number;
  status: RunStatus;
  events: VaultEvent[];
};

const time = (ts: number) => new Date(ts * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const CHIP: Record<RunStatus, { text: string; kind: ChipKind }> = {
  None: { text: "UNKNOWN", kind: "idle" },
  Proposed: { text: "AWAITING", kind: "awaiting" },
  Approved: { text: "APPROVED", kind: "awaiting" },
  Cancelled: { text: "CANCELLED", kind: "refused" },
  Executed: { text: "SIGNED", kind: "signed" },
};

const STEP_NAME: Record<string, string> = {
  RunProposed: "Drafted",
  RunApproved: "Approved",
  RunCancelled: "Cancelled",
  RunExecuted: "Signed and paid",
};

/** One check, ticking in 80ms after the one before it. */
function Check({ ok, label, i }: { ok: boolean; label: string; i: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: i * 0.08, duration: 0.15 }}
      className="flex items-center justify-between gap-3 border-t border-border py-2 font-mono text-[13px] first:border-t-0"
    >
      <span>{label}</span>
      <span className={ok ? "text-[var(--signed)]" : "text-[var(--refused)]"}>{ok ? "✓ PASS" : "✕ FAIL"}</span>
    </motion.li>
  );
}

function RunsSkeleton() {
  return (
    <div aria-busy="true" className="pt-4">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="mt-3 h-12 w-full max-w-lg" />
      <div className="mt-6 grid gap-2">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[73px] w-full" />)}
      </div>
    </div>
  );
}

export default function RunsPage() {
  const v = useVault();
  const tx = useTx();
  const now = useNow();
  const events = useVaultEvents(v.vault, v.policyAddress);
  const [open, setOpen] = useState<Hex | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const vault = v.vault;
    if (vault) queueMicrotask(() => setNames(payeeNames(vault)));
  }, [v.vault]);

  const keys = useMemo(
    () => [...new Set((events.data ?? []).filter((e) => e.name === "RunProposed").map((e) => e.args.runKey as Hex))],
    [events.data],
  );

  const details = useReadContracts({
    allowFailure: false,
    query: { enabled: !!v.vault && keys.length > 0, refetchInterval: 10_000 },
    contracts: keys.map((k) => ({ address: v.vault as Address, abi: payrollVaultAbi, functionName: "getRun", args: [k] })),
  });

  const runs: Run[] = useMemo(() => {
    const d = (details.data ?? []) as unknown as {
      payeeIds: readonly Hex[]; amounts: readonly bigint[]; total: bigint; executableAt: bigint; status: number;
    }[];
    return keys
      .map((k, i) => ({
        runKey: k,
        payeeIds: d[i]?.payeeIds ?? [],
        amounts: d[i]?.amounts ?? [],
        total: d[i]?.total ?? 0n,
        executableAt: Number(d[i]?.executableAt ?? 0n),
        status: RUN_STATUS[d[i]?.status ?? 0],
        events: (events.data ?? []).filter((e) => e.args.runKey === k),
      }))
      .reverse();
  }, [keys, details.data, events.data]);

  // payee wallets for seals
  const wallets = useMemo(() => {
    const m = new Map<string, Address>();
    for (const e of events.data ?? []) if (e.name === "PayeeConfirmed") m.set(String(e.args.payeeId), e.args.wallet as Address);
    return m;
  }, [events.data]);

  if (!v.isConnected) return <p className="pt-10 text-[16px] text-muted-foreground">Connect your wallet to see runs.</p>;
  if (v.loading || events.isLoading || (keys.length > 0 && details.isLoading)) return <RunsSkeleton />;
  if (!v.hasVault || !v.vault) return <p className="pt-10 text-[16px] text-muted-foreground">Create your vault on the Overview page first.</p>;

  const vault = v.vault;

  return (
    <div className="pt-4">
      <p className="meta text-muted-foreground">Runs</p>
      <h1 className="page-title mt-1">
        Your assistant drafts. <em>You sign.</em>
      </h1>
      {events.isError && <p role="alert" className="mt-4 text-[14px] text-[var(--refused)]">Could not load runs. Check your connection and reload.</p>}

      {runs.length === 0 ? (
        <p className="mt-6 max-w-md text-[16px] text-muted-foreground">
          No drafts yet. When your assistant prepares a payroll run it will wait here for your review.
        </p>
      ) : (
        <ul className="mt-6 grid gap-1">
          {runs.map((r) => {
            const chip = CHIP[r.status];
            const proposed = r.events.find((e) => e.name === "RunProposed");
            const isOpen = open === r.runKey;
            const { checks, refusal } = checkRun({
              amounts: r.amounts,
              total: r.total,
              status: r.status,
              payeeCount: r.payeeIds.length,
              confirmedCount: r.payeeIds.filter((id) => wallets.has(id)).length,
              policy: v.policy,
              revoked: v.revoked,
              paused: v.paused,
              remaining: v.remaining,
              now,
            });
            const live = r.status === "Proposed" || r.status === "Approved";
            const refused = live && refusal !== null;
            const paidTx = r.events.find((e) => e.name === "RunExecuted");
            const cancelTx = r.events.find((e) => e.name === "RunCancelled");
            const count = r.payeeIds.length;

            return (
              <li
                key={r.runKey}
                className={cn("border px-4", isOpen ? "rounded-2xl border-[var(--gold)]/50 bg-card" : "rounded-none border-transparent border-b-border")}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : r.runKey)}
                  aria-expanded={isOpen}
                  className="flex min-h-[73px] w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-xl py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-[18px]">
                      Pay {count} {count === 1 ? "person" : "people"}
                    </p>
                    <p className="meta mt-0.5 text-muted-foreground">
                      {proposed ? time(proposed.timestamp) : ""} · {shortHash(r.runKey)}
                    </p>
                  </div>
                  <span className="tnum font-serif text-[18px]">
                    {formatAmount(r.total)} <span className="text-[13px] text-muted-foreground">{TOKEN_SYMBOL}</span>
                  </span>
                  <StatusChip kind={refused ? "refused" : chip.kind}>{refused ? "REFUSED" : chip.text}</StatusChip>
                </button>

                {isOpen && (
                  <div className="grid gap-6 pb-6 md:grid-cols-2">
                    {refused && (
                      <section role="alert" className="rounded-2xl border border-[var(--refused)]/60 bg-[var(--refused)]/10 p-5 md:col-span-2">
                        <h2 className="text-[22px] text-[var(--refused)]">Refused by the contract</h2>
                        <p className="mt-2 text-[16px]">{refusal}</p>
                      </section>
                    )}

                    {r.status === "Cancelled" && (
                      <section className="rounded-2xl border border-[var(--refused)]/40 p-5 md:col-span-2">
                        <h2 className="text-[22px] text-[var(--refused)]">Cancelled</h2>
                        <p className="mt-2 text-[16px]">You cancelled this draft. Nothing was paid.</p>
                        {cancelTx && (
                          <a href={txUrl(cancelTx.txHash)} target="_blank" rel="noreferrer" className="mt-2 inline-block font-mono text-[12px] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
                            {shortHash(cancelTx.txHash)}
                          </a>
                        )}
                      </section>
                    )}

                    <section aria-label="Draft" className="panel-dark rounded-2xl border border-border p-5">
                      <p className="text-[16px]">
                        Pay {count} {count === 1 ? "person" : "people"}, {formatAmount(r.total)} {TOKEN_SYMBOL} in total.
                      </p>
                      <ul className="mt-4 divide-y divide-border">
                        {r.payeeIds.map((id, i) => (
                          <li key={id} className="flex min-h-[53px] items-center gap-3 py-2.5">
                            <Seal address={wallets.get(id)} size={32} className="shrink-0 text-[var(--mist)]" />
                            <span className="min-w-0 flex-1 truncate">
                              {names.get(id) ? (
                                <span className="font-serif text-[16px]">{names.get(id)}</span>
                              ) : (
                                <span className="font-mono text-[12px] text-[var(--sage)]">{shortHash(id)}</span>
                              )}
                            </span>
                            <span className="tnum font-serif text-[16px]">{formatAmount(r.amounts[i])}</span>
                          </li>
                        ))}
                      </ul>
                      {v.policy && (
                        <p className="mt-4 text-[13px] text-[var(--sage)]">
                          Rules: per person {formatAmount(v.policy.perPayee)}, per run {formatAmount(v.policy.perRun)} {TOKEN_SYMBOL}.
                        </p>
                      )}
                    </section>

                    <section aria-label="Checks" className="panel-dark rounded-2xl border border-border p-5">
                      <div className="flex items-baseline justify-between gap-3">
                        <h2 className="text-[18px]">Checks the contract enforces</h2>
                        <span className="meta text-muted-foreground">
                          {checks.filter((c) => c.ok).length}/{checks.length}
                        </span>
                      </div>
                      <ul className="mt-3">
                        {checks.map((c, i) => <Check key={c.label} ok={c.ok} label={c.label} i={i} />)}
                      </ul>
                    </section>

                    <section aria-label="Timeline" className="panel-dark rounded-2xl border border-border p-5">
                      <EventTimeline withDate={false} events={r.events.filter((e) => e.name in STEP_NAME)} label={(e) => STEP_NAME[e.name]} />
                    </section>

                    <section aria-label="Actions" className="flex flex-wrap items-start gap-3 self-start">
                      {r.status === "Executed" && (
                        <div className="grid gap-1">
                          <SignatureMark name={v.address ? shortAddress(v.address) : "Signed"} className="text-[44px] text-[var(--forest-900)] dark:text-[var(--gold)]" />
                          <p className="font-mono text-[11px] text-muted-foreground">
                            Signed and paid · {formatAmount(r.total)} {TOKEN_SYMBOL}
                          </p>
                          {paidTx && (
                            <a href={txUrl(paidTx.txHash)} target="_blank" rel="noreferrer" className="w-fit font-mono text-[12px] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
                              {shortHash(paidTx.txHash)}
                            </a>
                          )}
                        </div>
                      )}
                      {r.status === "Proposed" && (
                        <>
                          <Button className="rounded-full" disabled={refused} onClick={() => tx("Approve run", { address: vault, abi: payrollVaultAbi, functionName: "approveRun", args: [r.runKey] })}>
                            Approve
                          </Button>
                          <Button variant="outline" className="rounded-full" onClick={() => tx("Cancel run", { address: vault, abi: payrollVaultAbi, functionName: "cancelRun", args: [r.runKey] })}>
                            Cancel
                          </Button>
                        </>
                      )}
                      {r.status === "Approved" && (
                        <>
                          <Button
                            className="rounded-full"
                            disabled={now === 0 || now < r.executableAt || refused}
                            onClick={() => tx("Sign and pay", { address: vault, abi: payrollVaultAbi, functionName: "executeRun", args: [r.runKey] })}
                          >
                            Sign and pay
                          </Button>
                          <Button variant="outline" className="rounded-full" onClick={() => tx("Cancel run", { address: vault, abi: payrollVaultAbi, functionName: "cancelRun", args: [r.runKey] })}>
                            Cancel
                          </Button>
                        </>
                      )}
                      {live && now > 0 && (
                        <p className="meta w-full text-muted-foreground">
                          {now < r.executableAt ? `Review window: ${formatDuration(r.executableAt - now)} left` : "Review window closed"}
                        </p>
                      )}
                    </section>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
