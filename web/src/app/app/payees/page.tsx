"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { toast } from "sonner";
import type { Address, Hex } from "viem";
import { Seal } from "@/components/seal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/status-chip";
import { payrollVaultAbi } from "@/lib/contracts";
import { addressUrl } from "@/lib/chain";
import { shortAddress } from "@/lib/format";
import { inviteLink, payeeId, randomSalt } from "@/lib/payee";
import { useFreshKeys } from "@/lib/use-fresh";
import { useVaultEvents } from "@/lib/use-logs";
import { useTx } from "@/lib/use-tx";
import { useVault } from "@/lib/use-vault";

type Invite = { name: string; salt: Hex; id: Hex };

const storeKey = (vault: string) => `paywarden:invites:${vault.toLowerCase()}`;

function loadInvites(vault: string): Invite[] {
  try {
    return JSON.parse(localStorage.getItem(storeKey(vault)) ?? "[]");
  } catch {
    return [];
  }
}

export default function PayeesPage() {
  const v = useVault();
  const tx = useTx();
  const events = useVaultEvents(v.vault, v.policyAddress);
  const [name, setName] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const vault = v.vault;
    if (vault) queueMicrotask(() => setInvites(loadInvites(vault)));
  }, [v.vault]);

  // payeeId -> wallet, from PayeeConfirmed events
  const confirmed = useMemo(() => {
    const m = new Map<string, Address>();
    for (const e of events.data ?? []) {
      if (e.name === "PayeeConfirmed") m.set(String(e.args.payeeId), e.args.wallet as Address);
    }
    return m;
  }, [events.data]);

  // A seal only draws in when a payee confirms while this page is open; on load they are already drawn.
  const confirmedIds = useMemo(() => [...confirmed.keys()], [confirmed]);
  const fresh = useFreshKeys(confirmedIds, events.isLoading, 2500);

  const invite = async () => {
    if (!v.vault || !name.trim()) return;
    const salt = randomSalt();
    const id = payeeId(name.trim(), salt);
    setBusy(true);
    const hash = await tx(`Invite ${name.trim()}`, { address: v.vault, abi: payrollVaultAbi, functionName: "invitePayee", args: [id] });
    setBusy(false);
    if (!hash) return;
    const next = [{ name: name.trim(), salt, id }, ...invites];
    setInvites(next);
    try {
      localStorage.setItem(storeKey(v.vault), JSON.stringify(next));
    } catch {
      toast.warning("Copy the invite link now: this browser could not save it.");
    }
    setName("");
  };

  const copy = async (i: Invite) => {
    const link = inviteLink(window.location.origin, v.vault!, i.name, i.salt);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(i.id);
      setTimeout(() => setCopied((c) => (c === i.id ? null : c)), 2000);
      toast.success("Copied", { description: `Send ${i.name} the invite link.` });
    } catch {
      toast.error("Could not copy. Select the link and copy it by hand.", { description: link });
    }
  };

  if (!v.isConnected) return <p className="pt-10 text-[16px] text-muted-foreground">Connect your wallet to manage payees.</p>;
  if (v.loading)
    return (
      <div aria-busy="true" className="grid gap-8 pt-4">
        <div className="grid gap-3">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-5 w-full max-w-xl" />
        </div>
        <Skeleton className="h-[148px] w-full rounded-2xl" />
        <div className="grid gap-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[73px] w-full" />)}
        </div>
      </div>
    );
  if (!v.hasVault) return <p className="pt-10 text-[16px] text-muted-foreground">Create your vault on the Overview page first.</p>;

  return (
    <div className="grid gap-8 pt-4">
      <header>
        <h1 className="page-title">
          Who you <em>pay</em>
        </h1>
        <p className="mt-2 max-w-xl text-[16px] text-muted-foreground">
          Invite someone by name. They confirm with their own wallet, so you never pay an address nobody has vouched for.
        </p>
      </header>

      <section aria-labelledby="inv" className="rounded-2xl border border-border bg-card p-6">
        <h2 id="inv" className="text-[22px]">
          Invite a payee
        </h2>
        <div className="mt-4 flex max-w-lg flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-1.5">
            <Label htmlFor="pname">Full name</Label>
            <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" />
          </div>
          <Button className="rounded-full" disabled={busy || !name.trim()} onClick={invite}>
            Send invite
          </Button>
        </div>
      </section>

      <section aria-labelledby="list">
        <h2 id="list" className="text-[22px]">
          Your payees
        </h2>
        {invites.length === 0 ? (
          <p className="mt-3 text-[14px] text-muted-foreground">No one yet. Invite your first payee above.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border border-y border-border">
            <AnimatePresence initial={false}>
              {invites.map((i) => {
                const wallet = confirmed.get(i.id);
                return (
                  <motion.li
                    key={i.id}
                    layout="position"
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="relative flex min-h-[73px] flex-wrap items-center gap-x-4 gap-y-2 py-4"
                  >
                    {fresh.has(i.id) && !reduce && (
                      <motion.span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-[var(--gold)]"
                        initial={{ opacity: 0.3 }}
                        animate={{ opacity: 0 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                      />
                    )}
                    <Seal address={wallet} size={40} animate={fresh.has(i.id)} breathe className="shrink-0 text-[var(--forest-900)] dark:text-[var(--mist)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-serif text-[18px]">{i.name}</p>
                      {wallet ? (
                        <a href={addressUrl(wallet)} target="_blank" rel="noreferrer" className="font-mono text-[12px] text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
                          {shortAddress(wallet)}
                        </a>
                      ) : (
                        <p className="text-[12px] text-muted-foreground">Not a confirmed payee</p>
                      )}
                    </div>
                    <StatusChip kind={wallet ? "signed" : "awaiting"}>{wallet ? "Confirmed" : "Invited"}</StatusChip>
                    {!wallet && (
                      <Button variant="outline" size="sm" className="min-w-[148px] rounded-full" onClick={() => copy(i)}>
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span
                            key={copied === i.id ? "done" : "idle"}
                            className="inline-flex items-center gap-1.5"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                          >
                            {copied === i.id ? (
                              <>
                                <Check className="size-3.5" aria-hidden /> Copied
                              </>
                            ) : (
                              "Copy invite link"
                            )}
                          </motion.span>
                        </AnimatePresence>
                      </Button>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}
