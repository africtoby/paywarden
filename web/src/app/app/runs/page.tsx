"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useReadContracts } from "wagmi";
import type { Address, Hex } from "viem";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Seal } from "@/components/seal";
import { SignatureMark } from "@/components/signature-mark";
import { payrollVaultAbi, RUN_STATUS, TOKEN_SYMBOL, type RunStatus } from "@/lib/contracts";
import { txUrl } from "@/lib/chain";
import { formatAmount, formatDuration, shortHash } from "@/lib/format";
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

const time = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const CHIP: Record<RunStatus, { text: string; cls: string }> = {
  None: { text: "UNKNOWN", cls: "" },
  Proposed: { text: "AWAITING", cls: "bg-[var(--amber)]/20 text-[var(--amber-ink)]" },
  Approved: { text: "APPROVED", cls: "bg-[var(--amber)]/20 text-[var(--amber-ink)]" },
  Cancelled: { text: "REFUSED", cls: "bg-[var(--refused)]/15 text-[var(--refused)]" },
  Executed: { text: "SIGNED", cls: "bg-[var(--signed)]/15 text-[var(--signed)]" },
};

function Check({ ok, label, i }: { ok: boolean; label: string; i: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: i * 0.08 }}
      className="flex items-center justify-between gap-3 border-t border-border py-2 font-mono text-[13px] first:border-t-0"
    >
      <span>{label}</span>
      <span className={ok ? "text-[var(--signed)]" : "text-[var(--refused)]"}>{ok ? "PASS" : "FAIL"}</span>
    </motion.li>
  );
}

export default function RunsPage() {
  const v = useVault();
  const tx = useTx();
  const now = useNow();
  const events = useVaultEvents(v.vault, v.policyAddress);
  const [open, setOpen] = useState<Hex | null>(null);

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
  if (v.loading || events.isLoading) return <Skeleton className="mt-6 h-72 w-full rounded-2xl" aria-busy="true" />;
  if (!v.hasVault || !v.vault) return <p className="pt-10 text-[16px] text-muted-foreground">Create your vault on the Overview page first.</p>;

  const vault = v.vault;
  const selected = runs.find((r) => r.runKey === open) ?? null;

  return (
    <div className="pt-4">
      <p className="meta text-muted-foreground">Runs</p>
      <h1 className="page-title mt-1">
        Your assistant drafts. <em>You sign.</em>
      </h1>

      {runs.length === 0 ? (
        <p className="mt-6 max-w-md text-[16px] text-muted-foreground">
          No drafts yet. When your assistant prepares a payroll run it will wait here for your review.
        </p>
      ) : (
        <ul className="mt-6 grid gap-1">
          {runs.map((r) => {
            const chip = CHIP[r.status];
            const proposed = r.events.find((e) => e.name === "RunProposed");
            return (
              <li
                key={r.runKey}
                className={cn(
                  "border px-4",
                  open === r.runKey ? "rounded-2xl border-gold/50 bg-card" : "rounded-none border-transparent border-b-border",
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpen(open === r.runKey ? null : r.runKey)}
                  aria-expanded={open === r.runKey}
                  className="flex w-full items-center gap-4 py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-[18px]">
                      Pay {r.payeeIds.length} {r.payeeIds.length === 1 ? "person" : "people"}
                    </p>
                    <p className="meta mt-0.5 text-muted-foreground">
                      {proposed ? time(proposed.timestamp) : ""} · {shortHash(r.runKey)}
                    </p>
                  </div>
                  <span className="tnum font-serif text-[18px]">
                    {formatAmount(r.total)} <span className="text-[13px] text-muted-foreground">{TOKEN_SYMBOL}</span>
                  </span>
                  <span className={`meta rounded-full px-3 py-1 ${chip.cls}`}>{chip.text}</span>
                </button>

                {selected?.runKey === r.runKey && (
                  <div className="grid gap-6 pb-6 md:grid-cols-2">
                    <section aria-label="Draft" className="panel-dark rounded-2xl border border-border p-5">
                      <p className="text-[16px]">
                        Pay {r.payeeIds.length} {r.payeeIds.length === 1 ? "person" : "people"}, {formatAmount(r.total)} {TOKEN_SYMBOL} in total.
                      </p>
                      <ul className="mt-4 divide-y divide-border">
                        {r.payeeIds.map((id, i) => (
                          <li key={id} className="flex items-center gap-3 py-2.5">
                            <Seal address={wallets.get(id)} size={32} className="text-[var(--mist)]" />
                            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--sage)]">{shortHash(id)}</span>
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
                      <h2 className="text-[18px]">Checks the contract enforces</h2>
                      <ul className="mt-3">
                        {(() => {
                          const p = v.policy;
                          const list: [string, boolean][] = [
                            ["Confirmed payee", r.payeeIds.every((id) => wallets.has(id))],
                            ["Per-person cap", !!p && r.amounts.every((a) => a <= p.perPayee)],
                            ["Per-run cap", !!p && r.total <= p.perRun],
                            ["Period cap", r.status !== "Proposed" || (v.remaining ?? 0n) >= r.total],
                            ["Assistant not expired", !v.revoked && !!p && (p.expiry === 0n || Number(p.expiry) > now)],
                            ["Vault not paused", !v.paused],
                            ["Not already paid", r.status !== "Executed"],
                          ];
                          return list.map(([label, ok], i) => <Check key={label} label={label} ok={ok} i={i} />);
                        })()}
                      </ul>
                    </section>

                    <section aria-label="Timeline" className="panel-dark rounded-2xl border border-border p-5">
                      <ol className="grid gap-3">
                        {r.events
                          .filter((e) => ["RunProposed", "RunApproved", "RunCancelled", "RunExecuted"].includes(e.name))
                          .map((e) => (
                            <li key={e.txHash + e.logIndex} className="flex items-baseline gap-3 font-mono text-[12px]">
                              <span className="text-[var(--sage)]">{time(e.timestamp)}</span>
                              <a href={txUrl(e.txHash)} target="_blank" rel="noreferrer" className="uppercase underline-offset-4 hover:underline">
                                {{ RunProposed: "Drafted", RunApproved: "Approved", RunCancelled: "Cancelled", RunExecuted: "Signed and paid" }[e.name]}
                              </a>
                            </li>
                          ))}
                      </ol>
                    </section>

                    <section aria-label="Actions" className="flex flex-wrap items-start gap-3">
                      {r.status === "Executed" && (
                        <div>
                          <SignatureMark name="Approved" className="text-[44px] text-[var(--forest-900)] dark:text-[var(--gold)]" />
                          <p className="font-mono text-[11px] text-muted-foreground">Signed and paid · {formatAmount(r.total)} {TOKEN_SYMBOL}</p>
                        </div>
                      )}
                      {r.status === "Proposed" && (
                        <>
                          <Button className="rounded-full" onClick={() => tx("Approve run", { address: vault, abi: payrollVaultAbi, functionName: "approveRun", args: [r.runKey] })}>
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
                            disabled={now < r.executableAt}
                            onClick={() => tx("Sign and pay", { address: vault, abi: payrollVaultAbi, functionName: "executeRun", args: [r.runKey] })}
                          >
                            Sign and pay
                          </Button>
                          <p className="meta self-center text-muted-foreground">
                            {now < r.executableAt ? `Review window: ${formatDuration(r.executableAt - now)} left` : "Review window closed"}
                          </p>
                        </>
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
