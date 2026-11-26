"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { ConnectPrompt } from "@/components/connect-prompt";
import { zeroAddress } from "viem";
import { AllowanceMeter } from "@/components/allowance-meter";
import { BalanceCard } from "@/components/balance-card";
import { Wizard, wizardStep } from "@/components/wizard";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip, type ChipKind } from "@/components/status-chip";
import { Button, buttonVariants } from "@/components/ui/button";
import { addressUrl, txUrl } from "@/lib/chain";
import { describeEvent } from "@/lib/describe-event";
import { formatDuration, formatMoney, shortAddress, shortHash } from "@/lib/format";
import { useFreshKeys } from "@/lib/use-fresh";
import { useVaultEvents, type VaultEvent } from "@/lib/use-logs";
import { useVault } from "@/lib/use-vault";
import { useTx } from "@/lib/use-tx";
import { payrollVaultAbi } from "@/lib/contracts";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-border py-3 text-[14px] first:border-t-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

const NEXT: Record<string, { kind: ChipKind; text: string }> = {
  RunProposed: { kind: "awaiting", text: "Awaiting" },
  RunApproved: { kind: "signed", text: "Signed" },
  RunCancelled: { kind: "refused", text: "Cancelled" },
  RunExecuted: { kind: "signed", text: "Paid" },
};

/** The latest drafted run and where it stands, read from the event log. */
function latestRun(events: readonly VaultEvent[]) {
  const proposed = [...events].reverse().find((e) => e.name === "RunProposed");
  if (!proposed) return null;
  const later = events.filter((e) => e.args.runKey === proposed.args.runKey && e.name in NEXT);
  const last = later[later.length - 1] ?? proposed;
  return { total: proposed.args.total as bigint, chip: NEXT[last.name], at: proposed.timestamp };
}

function OverviewSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-8 pt-4">
      <Skeleton className="h-[188px] w-full rounded-2xl md:h-[204px]" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[330px] rounded-2xl" />
        <Skeleton className="h-[330px] rounded-2xl" />
      </div>
      <div className="grid gap-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
      </div>
    </div>
  );
}

export default function Overview() {
  const v = useVault();
  const tx = useTx();
  const events = useVaultEvents(v.vault, v.policyAddress);
  const [confirmPause, setConfirmPause] = useState(false);

  if (!v.isConnected) {
    return <ConnectPrompt title={<>Connect your wallet to <em>open your vault.</em></>} copy="Use the wallet that owns the payroll. You stay in control of every payment." />;
  }

  if (v.loading) return <OverviewSkeleton />;

  if (!v.hasVault) {
    return (
      <div className="grid max-w-xl gap-6 pt-4">
        <h1 className="page-title">Create your <em>vault.</em></h1>
        <p className="text-[16px] text-muted-foreground">One vault holds your payroll. Your assistant drafts runs against it, and only you can sign.</p>
        <Wizard />
      </div>
    );
  }

  const step = wizardStep(v);
  const hasAgent = !!v.policy && v.policy.agent !== zeroAddress;

  return (
    <div className="grid gap-8 pt-4">
      <BalanceCard balance={v.balance ?? 0n} paused={v.paused} />

      <Wizard />

      {step === 3 && v.policy && v.vault && (
        <div className="grid gap-6 md:grid-cols-2">
          <section aria-labelledby="allow" className="panel-dark rounded-2xl border border-border p-6">
            <h2 id="allow" className="text-[22px]">
              Assistant allowance
            </h2>
            <div className="mt-4">
              {hasAgent ? <AllowanceMeter cap={v.policy.periodCap} remaining={v.remaining ?? 0n} /> : <p className="text-[14px] text-muted-foreground">No assistant set.</p>}
            </div>
            <div className="mt-4">
              <Row label="Per run">{formatMoney(v.policy.perRun)}</Row>
              <Row label="Per person">{formatMoney(v.policy.perPayee)}</Row>
              <Row label="Period">{formatDuration(Number(v.policy.period))}</Row>
              <Row label="Status">{v.revoked ? "Revoked" : "Active"}</Row>
            </div>
            <Link href="/app/assistant" className={buttonVariants({ variant: "outline", className: "mt-4 rounded-full border-[var(--mist)]/30 bg-transparent text-[var(--mist)] hover:bg-[var(--mist)]/10 hover:text-[var(--mist)]" })}>
              Manage assistant
            </Link>
          </section>

          <section aria-labelledby="vault" className="rounded-2xl border border-border bg-card p-6">
            <h2 id="vault" className="text-[22px]">
              Your vault
            </h2>
            <div className="mt-4">
              <Row label="Address">
                <a className="font-mono text-[13px] underline-offset-4 hover:underline" href={addressUrl(v.vault)} target="_blank" rel="noreferrer">
                  {shortAddress(v.vault)}
                </a>
              </Row>
              <Row label="Review window">{formatDuration(v.reviewWindow ?? 0)}</Row>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/app/payees" className={buttonVariants({ className: "rounded-full" })}>
                Add payees
              </Link>
              {v.paused ? (
                <Button variant="outline" className="rounded-full" onClick={() => tx("Unpause vault", { address: v.vault!, abi: payrollVaultAbi, functionName: "unpause" })}>
                  Unpause
                </Button>
              ) : confirmPause ? (
                <div role="group" aria-label="Confirm pause" className="flex flex-wrap items-center gap-2 text-[14px]">
                  <span>Freeze proposing, approving and paying?</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={async () => {
                      await tx("Pause vault", { address: v.vault!, abi: payrollVaultAbi, functionName: "pause" });
                      setConfirmPause(false);
                    }}
                  >
                    Yes, pause
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setConfirmPause(false)}>
                    Keep running
                  </Button>
                </div>
              ) : (
                <Button variant="outline" className="rounded-full" onClick={() => setConfirmPause(true)}>
                  Pause everything
                </Button>
              )}
            </div>
          </section>
        </div>
      )}

      {step === 3 && <RecentActivity events={events.data} loading={events.isLoading} />}
    </div>
  );
}

function RecentActivity({ events, loading }: { events?: readonly VaultEvent[]; loading: boolean }) {
  const run = latestRun(events ?? []);
  const recent = [...(events ?? [])].reverse().slice(0, 5);
  const fresh = useFreshKeys(recent.map((e) => e.txHash + e.logIndex), loading);
  const reduce = useReducedMotion();
  return (
    <section aria-labelledby="recent" className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="recent" className="text-[22px]">Recent activity</h2>
        <Link href="/app/runs" className="flex min-h-7 items-center gap-3 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4">
          <span className="meta text-muted-foreground">Latest run</span>
          {run ? (
            <>
              <span className="tnum text-[14px]">{formatMoney(run.total)}</span>
              <StatusChip kind={run.chip.kind}>{run.chip.text}</StatusChip>
            </>
          ) : (
            <span className="text-[14px] text-muted-foreground">No run waiting</span>
          )}
        </Link>
      </div>
      {loading ? (
        <div aria-busy="true" className="grid gap-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
        </div>
      ) : recent.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">Nothing yet.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          <AnimatePresence initial={false}>
            {recent.map((e) => {
              const k = e.txHash + e.logIndex;
              return (
                <motion.li
                  key={k}
                  layout="position"
                  initial={{ opacity: 0, y: -14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="relative flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3"
                >
                  {fresh.has(k) && !reduce && (
                    <motion.span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 bg-[var(--gold)]"
                      initial={{ opacity: 0.28 }}
                      animate={{ opacity: 0 }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                    />
                  )}
                  <span className="meta relative w-[110px] shrink-0 text-muted-foreground">
                    {new Date(e.timestamp * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="relative min-w-0 flex-1 text-[14px]">{describeEvent(e)}</span>
                  <a href={txUrl(e.txHash)} target="_blank" rel="noreferrer" className="relative font-mono text-[12px] text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
                    {shortHash(e.txHash)}
                  </a>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
