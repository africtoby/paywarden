"use client";

import { useState } from "react";
import { isAddress, zeroAddress, type Address } from "viem";
import { AllowanceMeter } from "@/components/allowance-meter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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

  if (!v.isConnected) return <p className="pt-10 text-[16px] text-muted-foreground">Connect your wallet to manage your assistant.</p>;
  if (v.loading) return <Skeleton className="mt-6 h-72 w-full rounded-2xl" aria-busy="true" />;
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

  return (
    <div className="agent-area -mx-5 min-h-[70vh] px-5 py-8 md:mx-0 md:rounded-[24px] md:px-8">
      <p className="meta text-[var(--sage)]">Assistant</p>
      <h1 className="mt-1 text-[36px] leading-tight">What your assistant may do.</h1>
      <p className="mt-2 max-w-xl text-[16px] text-[var(--mist)]/70">
        It can only draft runs inside these limits. It can never approve or pay. You can switch it off at any time.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="now" className="rounded-2xl border border-[var(--mist)]/12 bg-[var(--forest-900)] p-6">
          <h2 id="now" className="text-[22px]">Current permissions</h2>
          {hasAgent && p ? (
            <>
              <div className="mt-4"><AllowanceMeter cap={p.periodCap} remaining={v.remaining ?? 0n} /></div>
              <dl className="mt-4 divide-y divide-[var(--mist)]/12 text-[14px]">
                {([
                  ["Assistant", <a key="a" className="font-mono text-[13px] hover:underline" href={addressUrl(p.agent)} target="_blank" rel="noreferrer">{shortAddress(p.agent)}</a>],
                  ["Per run", `${formatAmount(p.perRun)} ${TOKEN_SYMBOL}`],
                  ["Per person", `${formatAmount(p.perPayee)} ${TOKEN_SYMBOL}`],
                  ["Period", formatDuration(Number(p.period))],
                  ["Expires", p.expiry === 0n ? "Never" : new Date(Number(p.expiry) * 1000).toLocaleDateString()],
                  ["Status", v.revoked ? "Switched off" : expired ? "Expired" : "Active"],
                ] as [string, React.ReactNode][]).map(([k, val]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5">
                    <dt className="text-[var(--sage)]">{k}</dt>
                    <dd>{val}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 flex flex-wrap gap-3">
                {!v.revoked && (
                  <Button variant="outline" className="rounded-full border-[var(--refused)] text-[var(--refused)]"
                    onClick={() => tx("Switch off assistant", { address: policyAddress, abi: agentSpendPolicyAbi, functionName: "revoke" })}>
                    Switch off
                  </Button>
                )}
                <Button variant="outline" className="rounded-full"
                  onClick={() => tx("Register assistant identity", { address: vault, abi: payrollVaultAbi, functionName: "registerAgentIdentity" })}>
                  Register assistant identity
                </Button>
              </div>
            </>
          ) : (
            <p className="mt-3 text-[14px] text-[var(--mist)]/70">No assistant set yet. Choose one on the right.</p>
          )}
        </section>

        <section aria-labelledby="edit" className="rounded-2xl border border-[var(--mist)]/12 p-6">
          <h2 id="edit" className="text-[22px]">{hasAgent ? "Change permissions" : "Set permissions"}</h2>
          <div className="mt-4 grid gap-4">
            <Field id="agent" label="Assistant wallet address" value={agent} set={(x) => setAgent(x.trim())} mode="text" />
            <div className="grid grid-cols-2 gap-4">
              <Field id="perRun" label={`Per run (${TOKEN_SYMBOL})`} value={perRun} set={setPerRun} />
              <Field id="perPayee" label="Per person" value={perPayee} set={setPerPayee} />
              <Field id="periodCap" label="Per period" value={periodCap} set={setPeriodCap} />
              <Field id="days" label="Period (days)" value={days} set={setDays} mode="numeric" />
            </div>
            <Field id="expiry" label="Lasts (days)" value={expiryDays} set={setExpiryDays} mode="numeric" />
            <p className="text-[12px] text-[var(--sage)]">Leave a limit empty to keep its current value.</p>
            <Button className="w-fit rounded-full" disabled={busy || !agentValid} onClick={save}>
              Save permissions
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
