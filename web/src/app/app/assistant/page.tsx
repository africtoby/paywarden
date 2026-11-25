"use client";

import { ConnectPrompt } from "@/components/connect-prompt";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sweep } from "@/components/sweep";
import { isAddress, zeroAddress, type Address } from "viem";
import { AllowanceMeter } from "@/components/allowance-meter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { permissionParts } from "@/lib/assistant-sentence";
import { agentSpendPolicyAbi, payrollVaultAbi, TOKEN_SYMBOL } from "@/lib/contracts";
import { addressUrl } from "@/lib/chain";
import { formatAmount, formatDuration, parseAmount, shortAddress } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { useTx } from "@/lib/use-tx";
import { useVault } from "@/lib/use-vault";

function Field({ id, label, value, set, mode = "decimal" }: { id: string; label: string; value: string; set: (v: string) => void; mode?: "decimal" | "numeric" | "text" }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} inputMode={mode} value={value} onChange={(e) => set(e.target.value)} />
    </div>
  );
}

export default function AssistantPage() {
  const v = useVault();
  const tx = useTx();
  const now = useNow();
  const p = v.policy;

  const [agent, setAgent] = useState("");
  const [perRun, setPerRun] = useState("");
  const [perPayee, setPerPayee] = useState("");
  const [periodCap, setPeriodCap] = useState("");
  const [days, setDays] = useState("30");
  const [expiryDays, setExpiryDays] = useState("90");
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const reduce = useReducedMotion();

  if (!v.isConnected) return <ConnectPrompt title={<>Connect your wallet to <em>manage your assistant.</em></>} copy="Set what your assistant may draft, and switch it off any time." />;
  if (v.loading)
    return (
      <div aria-busy="true" className="pt-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-12 w-full max-w-lg" />
        <Skeleton className="mt-3 h-5 w-full max-w-xl" />
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[470px] rounded-2xl" />
          <Skeleton className="h-[470px] rounded-2xl" />
        </div>
      </div>
    );
  if (!v.hasVault || !v.policyAddress || !v.vault) return <p className="pt-10 text-[16px] text-muted-foreground">Create your vault on the Overview page first.</p>;

  const policyAddress = v.policyAddress;
  const vault = v.vault;
  const hasAgent = !!p && p.agent !== zeroAddress;
  const expired = !!p && p.expiry !== 0n && Number(p.expiry) <= now;
  const agentValid = isAddress(agent || (p?.agent ?? ""));

  const save = async () => {
    const target = (agent || p?.agent) as Address;
    const r = parseAmount(perRun || formatAmount(p?.perRun ?? 0n, 6).replace(/,/g, ""));
    const pp = parseAmount(perPayee || formatAmount(p?.perPayee ?? 0n, 6).replace(/,/g, ""));
    const c = parseAmount(periodCap || formatAmount(p?.periodCap ?? 0n, 6).replace(/,/g, ""));
    if (!isAddress(target) || r === null || pp === null || c === null) return;
    setBusy(true);
    await tx("Update assistant permissions", {
      address: policyAddress,
      abi: agentSpendPolicyAbi,
      functionName: "setPolicy",
      args: [{
        agent: target,
        perRun: r,
        perPayee: pp,
        periodCap: c,
        period: BigInt(Math.round(Number(days) * 86400)),
        expiry: BigInt(Math.floor(Date.now() / 1000) + Math.round(Number(expiryDays) * 86400)),
      }],
    });
    setBusy(false);
  };

  const current = (raw: string, fallback?: bigint) => (raw.trim() ? parseAmount(raw) : (fallback ?? null));
  const live = [current(perPayee, p?.perPayee), current(perRun, p?.perRun), current(periodCap, p?.periodCap)];
  const days0 = Number(days);
  const expiry0 = Number(expiryDays);
  const sentence =
    now > 0 && live.every((x) => x !== null && x > 0n) && days0 > 0 && expiry0 > 0
      ? permissionParts({
          perPayee: live[0]!,
          perRun: live[1]!,
          periodCap: live[2]!,
          periodDays: Math.round(days0),
          expiry: Math.floor(now + expiry0 * 86400),
        })
      : null;

  return (
    <div className="pt-4">
      <p className="meta text-muted-foreground">Assistant</p>
      <h1 className="page-title mt-1">
        Your assistant drafts. <em>You sign.</em>
      </h1>
      <p className="mt-2 max-w-xl text-[16px] text-muted-foreground">
        It can only draft runs inside these limits. It can never approve or pay. You can switch it off at any time.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="now"
          className="panel-dark relative rounded-2xl border border-border p-6 transition-[filter] duration-500 data-[off=true]:saturate-0"
          data-off={v.revoked}
        >
          <AnimatePresence>
            {v.revoked && hasAgent && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute right-5 top-5 rounded-md border-2 border-[var(--refused)] px-3 py-1 font-mono text-[13px] uppercase tracking-[0.12em] text-[var(--refused)]"
                initial={reduce ? { rotate: -6 } : { opacity: 0, scale: 1.5, rotate: 8 }}
                animate={{ opacity: 0.9, scale: 1, rotate: -6 }}
                transition={{ type: "spring", stiffness: 380, damping: 22 }}
              >
                Switched off
              </motion.div>
            )}
          </AnimatePresence>
          <h2 id="now" className="text-[22px]">Current permissions</h2>
          {hasAgent && p ? (
            <>
              <div className="mt-4"><AllowanceMeter cap={p.periodCap} remaining={v.remaining ?? 0n} /></div>
              <dl className="mt-4 divide-y divide-border text-[14px]">
                {([
                  ["Assistant", <a key="a" className="font-mono text-[13px] hover:underline" href={addressUrl(p.agent)} target="_blank" rel="noreferrer">{shortAddress(p.agent)}</a>],
                  ["Per run", `${formatAmount(p.perRun)} ${TOKEN_SYMBOL}`],
                  ["Per person", `${formatAmount(p.perPayee)} ${TOKEN_SYMBOL}`],
                  ["Period", formatDuration(Number(p.period))],
                  ["Expires", p.expiry === 0n ? "Never" : new Date(Number(p.expiry) * 1000).toLocaleDateString()],
                  ["Status", v.revoked ? "Switched off" : expired ? "Expired" : "Active"],
                ] as [string, React.ReactNode][]).map(([k, val]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd>{val}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 flex flex-wrap gap-3">
                {!v.revoked && !confirmOff && (
                  <Button variant="outline" className="rounded-full border-[var(--refused)] bg-transparent text-[var(--refused)] hover:bg-[var(--refused)]/10"
                    onClick={() => setConfirmOff(true)}>
                    Switch off
                  </Button>
                )}
                <AnimatePresence initial={false}>
                {!v.revoked && confirmOff && (
                  <motion.div
                    role="group"
                    aria-label="Confirm switching off"
                    className="w-full overflow-hidden"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                  <div className="rounded-xl border border-[var(--refused)]/50 p-4">
                    <p className="text-[14px]">Switch off the assistant? It will not be able to draft runs until you set new permissions.</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Button autoFocus variant="outline" className="rounded-full border-[var(--refused)] bg-[var(--refused)]/10 text-[var(--refused)] hover:bg-[var(--refused)]/20"
                        onClick={async () => { await tx("Switch off assistant", { address: policyAddress, abi: agentSpendPolicyAbi, functionName: "revoke" }); setConfirmOff(false); }}>
                        Yes, switch off
                      </Button>
                      <Button variant="outline" className="rounded-full border-[var(--mist)]/30 bg-transparent text-[var(--mist)] hover:bg-[var(--mist)]/10 hover:text-[var(--mist)]"
                        onClick={() => setConfirmOff(false)}>
                        Keep it on
                      </Button>
                    </div>
                  </div>
                  </motion.div>
                )}
                </AnimatePresence>
                <Button variant="outline" className="rounded-full border-[var(--mist)]/30 bg-transparent text-[var(--mist)] hover:bg-[var(--mist)]/10 hover:text-[var(--mist)]"
                  onClick={() => tx("Register assistant identity", { address: vault, abi: payrollVaultAbi, functionName: "registerAgentIdentity" })}>
                  Register assistant identity
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-3 text-[14px] text-muted-foreground">No assistant set yet. Choose one on the right.</p>
          )}
        </section>

        <section aria-labelledby="edit" className="rounded-2xl border border-border bg-card p-6">
          <h2 id="edit" className="text-[22px]">{hasAgent ? "Change permissions" : "Set permissions"}</h2>
          <div className="mt-4 grid gap-4">
            <Field id="agent" label="Assistant wallet address" value={agent} set={(x) => setAgent(x.trim())} mode="text" />
            <div className="grid grid-cols-2 gap-4">
              <Field id="perPayee" label={`Per person (${TOKEN_SYMBOL})`} value={perPayee} set={setPerPayee} />
              <Field id="perRun" label="Per run" value={perRun} set={setPerRun} />
              <Field id="periodCap" label="Monthly cap" value={periodCap} set={setPeriodCap} />
              <Field id="days" label="Period (days)" value={days} set={setDays} mode="numeric" />
            </div>
            <Field id="expiry" label="Lasts (days)" value={expiryDays} set={setExpiryDays} mode="numeric" />
            <p className="min-h-[3.75rem] rounded-xl bg-muted/60 p-3 text-[14px]">
              {sentence
                ? sentence.map((part, i) => (part.value ? <Sweep key={i} value={part.text}>{part.text}</Sweep> : <span key={i}>{part.text}</span>))
                : "Fill in each limit to see what the assistant will be allowed to do."}
            </p>
            <p className="text-[12px] text-muted-foreground">Leave a limit empty to keep its current value.</p>
            <Button className="w-fit rounded-full" disabled={busy || !agentValid} onClick={save}>
              Save permissions
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
