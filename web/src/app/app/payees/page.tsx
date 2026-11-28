"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { Check, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { isAddress, isHex, type Address, type Hex } from "viem";
import { ConnectPrompt } from "@/components/connect-prompt";
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

/** `wallet` is the wallet the invite is bound to, when the owner gave one. */
type Invite = { name: string; salt: Hex; id: Hex; wallet?: Address };

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
  const [walletInput, setWalletInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const walletRef = useRef<HTMLInputElement>(null);
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
      if (e.name === "PayeeRevoked") m.delete(String(e.args.payeeId));
    }
    return m;
  }, [events.data]);

  // A seal only draws in when a payee confirms while this page is open; on load they are already drawn.
  const confirmedIds = useMemo(() => [...confirmed.keys()], [confirmed]);
  const fresh = useFreshKeys(confirmedIds, events.isLoading, 2500);

  const save = (next: Invite[], warning: string) => {
    setInvites(next);
    try {
      localStorage.setItem(storeKey(v.vault!), JSON.stringify(next));
    } catch {
      toast.warning(warning);
    }
  };

  const walletTrim = walletInput.trim();
  // Every invite from the app is bound to the payee's wallet, so a copied invite link is useless to anyone else.
  const walletValid = isAddress(walletTrim);
  const walletError = walletTrim !== "" && !walletValid ? "That is not a wallet address. It starts with 0x and has 42 characters." : null;

  const invite = async () => {
    if (!v.vault || !name.trim() || !walletValid) return;
    const salt = randomSalt();
    const id = payeeId(name.trim(), salt);
    const wallet = walletTrim as Address;
    setBusy(true);
    const hash = await tx(`Invite ${name.trim()}`, { address: v.vault, abi: payrollVaultAbi, functionName: "invitePayee", args: [id, wallet] });
    setBusy(false);
    if (!hash) return;
    save([{ name: name.trim(), salt, id, wallet }, ...invites], "Copy the invite link now: this browser could not save it.");
    setName("");
    setWalletInput("");
  };

  // Invite links live only in this browser, so let the owner keep a copy and bring it back.
  const exportInvites = () => {
    const blob = new Blob([JSON.stringify({ vault: v.vault, invites }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `paywarden-invites-${v.vault!.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importInvites = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as { vault?: string; invites?: Invite[] };
      if (data.vault && data.vault.toLowerCase() !== v.vault!.toLowerCase()) {
        toast.error("This backup belongs to a different vault.");
        return;
      }
      const valid = (data.invites ?? []).filter(
        (i) => typeof i.name === "string" && isHex(i.salt, { strict: true }) && i.salt.length === 66 && payeeId(i.name, i.salt) === i.id && (!i.wallet || isAddress(i.wallet)),
      );
      const known = new Set(invites.map((i) => i.id));
      const added = valid.filter((i) => !known.has(i.id));
      save([...invites, ...added], "This browser could not save the imported invites.");
      toast.success(added.length ? `Imported ${added.length} invite${added.length === 1 ? "" : "s"}` : "Nothing new in that file");
    } catch {
      toast.error("Could not read that file. Choose a PayWarden invites backup (.json).");
    }
  };

  // Unlinking retires the invite for good (its salt is public once confirmed). The owner then invites the payee
  // again with the correct wallet, so the new invite is wallet-bound too.
  const unlink = async (i: Invite) => {
    if (!v.vault) return;
    setBusy(true);
    const revoked = await tx(`Unlink ${i.name}'s wallet`, { address: v.vault, abi: payrollVaultAbi, functionName: "revokePayee", args: [i.id] });
    setBusy(false);
    if (!revoked) return;
    save(invites.filter((x) => x.id !== i.id), "This browser could not update the invite list.");
    setName(i.name);
    setWalletInput("");
    toast.info(`Enter ${i.name}'s correct wallet to invite them again.`);
    walletRef.current?.focus();
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

  if (!v.isConnected) return <ConnectPrompt title={<>Connect your wallet to <em>manage your payees.</em></>} copy="Invite people by name. They confirm with their own wallet." />;
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
        <div className="mt-4 grid max-w-2xl gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="pname">Full name</Label>
            <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pwallet">
              Their wallet
            </Label>
            <Input id="pwallet" ref={walletRef} required value={walletInput} onChange={(e) => setWalletInput(e.target.value)} placeholder="0x…" aria-invalid={!!walletError} aria-describedby="pwallet-help" className="font-mono" spellCheck={false} />
          </div>
          <Button className="rounded-full" disabled={busy || !name.trim() || !walletValid} onClick={invite}>
            Send invite
          </Button>
        </div>
        <p id="pwallet-help" className={`mt-2 max-w-2xl text-[13px] ${walletError ? "text-[var(--refused)]" : "text-muted-foreground"}`}>
          {walletError ?? "Ask them for their wallet address. Only that wallet can accept the invite, even if someone else gets hold of the link."}
        </p>
      </section>

      <section aria-labelledby="list">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="list" className="text-[22px]">
            Your payees
          </h2>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="rounded-full" disabled={invites.length === 0} onClick={exportInvites}>
              <Download className="size-3.5" aria-hidden /> Back up invites
            </Button>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={() => fileRef.current?.click()}>
              <Upload className="size-3.5" aria-hidden /> Restore
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Restore invites from a backup file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importInvites(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">Invite links are kept in this browser only. Back them up so a cleared browser does not lose them.</p>
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
                        <p className="text-[12px] text-muted-foreground">
                          {i.wallet ? <>Waiting for <span className="font-mono">{shortAddress(i.wallet)}</span> to confirm</> : "Not a confirmed payee"}
                        </p>
                      )}
                    </div>
                    <StatusChip kind={wallet ? "signed" : "awaiting"}>{wallet ? "Confirmed" : "Invited"}</StatusChip>
                    {wallet && (
                      <Button variant="outline" size="sm" className="rounded-full" disabled={busy} onClick={() => unlink(i)}>
                        Unlink wallet
                      </Button>
                    )}
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
