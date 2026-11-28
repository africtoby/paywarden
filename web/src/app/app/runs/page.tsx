"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useReadContracts } from "wagmi";
import type { Address, Hex } from "viem";
import { ConnectPrompt } from "@/components/connect-prompt";
import { PaidCelebration } from "@/components/paid-celebration";
import { RippleField, type RippleHandle } from "@/components/landing/ripple-field";
import { ReviewRing } from "@/components/review-ring";
import { EventTimeline } from "@/components/event-timeline";
import { Seal } from "@/components/seal";
import { SignatureMark } from "@/components/signature-mark";
import { StatusChip, type ChipKind } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { payrollVaultAbi, RUN_STATUS, TOKEN_SYMBOL, type RunStatus } from "@/lib/contracts";
import { txUrl } from "@/lib/chain";
import { formatDuration, formatMoney, shortAddress, shortHash } from "@/lib/format";
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
  Approved: { text: "SIGNED", kind: "signed" },
  Cancelled: { text: "CANCELLED", kind: "refused" },
  Executed: { text: "PAID", kind: "signed" },
};

const STEP_NAME: Record<string, string> = {
  RunProposed: "Drafted",
  RunApproved: "Signed",
  RunCancelled: "Cancelled",
  RunExecuted: "Paid",
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

const rippled = new Set<string>();

/** The red "Refused by the contract" card. Engraved lines sit behind it and ripple red, once per run. */
function RefusalCard({ runKey, reason }: { runKey: string; reason: string }) {
  const card = useRef<HTMLElement>(null);
  const ripple = useRef<RippleHandle>(null);
  useEffect(() => {
    if (rippled.has(runKey)) return;
    rippled.add(runKey);
    const t = setTimeout(() => {
      const r = card.current?.getBoundingClientRect();
      if (r) ripple.current?.fire(r.left + r.width / 2, r.top + r.height / 2, "refuse");
    }, 280);
    return () => clearTimeout(t);
  }, [runKey]);
  return (
    <section ref={card} role="alert" className="relative overflow-hidden rounded-2xl border border-[var(--refused)]/60 bg-[var(--refused)]/10 p-5 md:col-span-2">
      <RippleField ref={ripple} className="absolute inset-0 size-full" />
      <h2 className="relative text-[22px] text-[var(--refused)]">Refused by the contract</h2>
      <p className="relative mt-2 text-[16px]">{reason}</p>
    </section>
  );
}

/** Button that turns into a progress state while its transaction is pending. */
function ActionButton({ pending, busyLabel, children, ...props }: { pending: boolean; busyLabel: string } & React.ComponentProps<typeof Button>) {
  return (
    <Button {...props} disabled={props.disabled || pending} aria-busy={pending} className={cn("relative overflow-hidden rounded-full", props.className)}>
      {pending ? busyLabel : children}
      {pending && (
        <motion.span
          aria-hidden
          className="absolute bottom-0 left-0 h-0.5 w-1/3 bg-current opacity-70"
          animate={{ x: ["-100%", "300%"] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        />
      )}
    </Button>
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
  const [pending, setPending] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<Hex | null>(null);
  const [payFor, setPayFor] = useState<Hex | null>(null);
  const [cancelFor, setCancelFor] = useState<Hex | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const reduce = useReducedMotion();

  // The name written as the signature lives only in this browser, like the payee names.
  const nameKey = v.vault ? `paywarden:owner-name:${v.vault.toLowerCase()}` : null;
  useEffect(() => {
    if (!nameKey) return;
    try {
      queueMicrotask(() => setOwnerName(localStorage.getItem(nameKey) ?? ""));
    } catch {}
  }, [nameKey]);
  const saveOwnerName = (value: string) => {
    setOwnerName(value);
    try {
      if (nameKey) localStorage.setItem(nameKey, value);
    } catch {}
  };

  const act = async (id: string, label: string, req: Parameters<typeof tx>[1]) => {
    setPending(id);
    const hash = await tx(label, req);
    setPending(null);
    return hash;
  };
  const signAndPay = async (key: Hex, req: Parameters<typeof tx>[1]) => {
    const hash = await act(`${key}:pay`, "Sign and pay", req);
    if (!hash) return;
    // The signature and the fan play first; the PAID chip lands when they are done (see the effect below).
    setCelebrate(key);
  };

  // Cancelling cannot be undone, so it takes a second click and stays out of the way of the primary button.
  const cancelControl = (key: Hex, vault: Address) =>
    cancelFor === key ? (
      <div role="group" aria-label="Confirm cancel" className="flex flex-wrap items-center gap-2 text-[14px]">
        <span>Cancel this run?</span>
        <ActionButton
          pending={pending === `${key}:cancel`}
          busyLabel="Cancelling…"
          variant="outline"
          disabled={!!pending}
          onClick={async () => {
            await act(`${key}:cancel`, "Cancel run", { address: vault, abi: payrollVaultAbi, functionName: "cancelRun", args: [key] });
            setCancelFor(null);
          }}
        >
          Yes, cancel it
        </ActionButton>
        <Button variant="ghost" size="sm" className="rounded-full" disabled={!!pending} onClick={() => setCancelFor(null)}>
          Keep it
        </Button>
      </div>
    ) : (
      <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground underline underline-offset-4" disabled={!!pending} onClick={() => setCancelFor(key)}>
        Cancel run
      </Button>
    );

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
    for (const e of events.data ?? []) {
      if (e.name === "PayeeConfirmed") m.set(String(e.args.payeeId), e.args.wallet as Address);
      if (e.name === "PayeeRevoked") m.delete(String(e.args.payeeId));
    }
    return m;
  }, [events.data]);

  const payRun = runs.find((r) => r.runKey === payFor);

  // The celebration starts once the chain shows the run as paid and lasts 1.25s.
  const celebrateStatus = runs.find((r) => r.runKey === celebrate)?.status;
  useEffect(() => {
    if (!celebrate || celebrateStatus !== "Executed") return;
    const t = setTimeout(() => setCelebrate(null), reduce ? 0 : 1250);
    return () => clearTimeout(t);
  }, [celebrate, celebrateStatus, reduce]);

  if (!v.isConnected) return <ConnectPrompt title={<>Connect your wallet to <em>see your runs.</em></>} copy="Drafts from your assistant wait here for your review and signature." />;
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
            // A cancelled run can be drafted again under the same key: the latest draft counts.
            const proposed = [...r.events].reverse().find((e) => e.name === "RunProposed");
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
            const cancelTx = r.status === "Cancelled" ? [...r.events].reverse().find((e) => e.name === "RunCancelled") : undefined;
            const count = r.payeeIds.length;
            const celebrating = celebrate === r.runKey;
            const slips = r.payeeIds.map((id, i) => ({
              name: names.get(id) ?? shortHash(id),
              role: TOKEN_SYMBOL,
              wallet: wallets.get(id) ?? id,
              amount: formatMoney(r.amounts[i]),
              tx: paidTx ? shortHash(paidTx.txHash) : undefined,
            }));
            const start = proposed?.timestamp ?? 0;

            return (
              <motion.li
                key={r.runKey}
                layout="position"
                transition={{ duration: 0.25, ease: "easeOut" }}
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
                    {formatMoney(r.total)}
                  </span>
                  <StatusChip kind={refused ? "refused" : celebrating ? "signed" : chip.kind}>{refused ? "REFUSED" : celebrating ? "SIGNED" : chip.text}</StatusChip>
                </button>

                <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    className="overflow-hidden"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                  <div className="grid gap-6 pb-6 md:grid-cols-2">
                    {refused && <RefusalCard runKey={r.runKey} reason={refusal!} />}

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
                        Pay {count} {count === 1 ? "person" : "people"}, {formatMoney(r.total)} in total.
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
                            <span className="font-mono text-[12px] text-[var(--sage)]" title="Wallet that will be paid">
                              {wallets.get(id) ? shortAddress(wallets.get(id)!) : "No wallet"}
                            </span>
                            <span className="tnum font-serif text-[16px]">{formatMoney(r.amounts[i])}</span>
                          </li>
                        ))}
                      </ul>
                      {v.policy && (
                        <p className="mt-4 text-[13px] text-[var(--sage)]">
                          Rules: per person {formatMoney(v.policy.perPayee)}, per run {formatMoney(v.policy.perRun)}.
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
                          <SignatureMark name={ownerName.trim() || (v.address ? shortAddress(v.address) : "Signed")} className="text-[56px] text-[var(--forest-900)] dark:text-[var(--gold)]" />
                          <p className="font-mono text-[11px] text-muted-foreground">
                            Signed and paid{v.address ? ` by ${shortAddress(v.address)}` : ""} · {formatMoney(r.total)}
                          </p>
                          {paidTx && (
                            <a href={txUrl(paidTx.txHash)} target="_blank" rel="noreferrer" className="w-fit font-mono text-[12px] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
                              {shortHash(paidTx.txHash)}
                            </a>
                          )}
                          <AnimatePresence>
                            {celebrating && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <PaidCelebration slips={slips} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                      {r.status === "Proposed" && (
                        <>
                          <ActionButton pending={pending === `${r.runKey}:approve`} busyLabel="Approving…" disabled={refused || !!pending} onClick={() => act(`${r.runKey}:approve`, "Approve run", { address: vault, abi: payrollVaultAbi, functionName: "approveRun", args: [r.runKey] })}>
                            Approve
                          </ActionButton>
                          {cancelControl(r.runKey, vault)}
                        </>
                      )}
                      {r.status === "Approved" && (
                        <>
                          <ActionButton
                            pending={pending === `${r.runKey}:pay`}
                            busyLabel="Signing and paying…"
                            disabled={now === 0 || now < r.executableAt || refused || !!pending}
                            onClick={() => setPayFor(r.runKey)}
                          >
                            Sign and pay
                          </ActionButton>
                          {cancelControl(r.runKey, vault)}
                        </>
                      )}
                      {live && now > 0 && (
                        <div className="flex w-full items-center gap-3 text-muted-foreground">
                          <ReviewRing now={now} start={start} end={r.executableAt} className="text-foreground" />
                          <p className="meta">
                            {now < r.executableAt ? `Review window: ${formatDuration(r.executableAt - now)} left` : "Review window closed"}
                          </p>
                        </div>
                      )}
                    </section>
                  </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!payRun} onOpenChange={(open) => !open && setPayFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review and sign</DialogTitle>
            <DialogDescription>
              {payRun ? `You are paying ${payRun.payeeIds.length} ${payRun.payeeIds.length === 1 ? "person" : "people"} ${formatMoney(payRun.total)} from your vault. This cannot be undone.` : ""}
            </DialogDescription>
          </DialogHeader>
          {payRun && (
            <ul className="divide-y divide-border text-[14px]">
              {payRun.payeeIds.map((id, i) => (
                <li key={id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate font-serif text-[16px]">{names.get(id) ?? shortHash(id)}</span>
                  <span className="font-mono text-[12px] text-muted-foreground">{wallets.get(id) ? shortAddress(wallets.get(id)!) : "No wallet"}</span>
                  <span className="tnum font-serif text-[16px]">{formatMoney(payRun.amounts[i])}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="owner-name">Name for your signature</Label>
            <Input id="owner-name" value={ownerName} maxLength={40} onChange={(e) => saveOwnerName(e.target.value)} placeholder={v.address ? shortAddress(v.address) : "Your name"} />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" className="rounded-full" />}>Not yet</DialogClose>
            <Button
              className="rounded-full"
              disabled={!payRun || !!pending}
              onClick={() => {
                if (!payRun || !v.vault) return;
                const key = payRun.runKey;
                setPayFor(null);
                void signAndPay(key, { address: v.vault, abi: payrollVaultAbi, functionName: "executeRun", args: [key] });
              }}
            >
              Sign and pay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
