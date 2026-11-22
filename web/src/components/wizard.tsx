"use client";

import { useState } from "react";
import { isAddress, zeroAddress, type Address } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADDRESSES, agentSpendPolicyAbi, erc20Abi, payrollVaultAbi, payrollVaultFactoryAbi, TOKEN_SYMBOL } from "@/lib/contracts";
import { parseAmount } from "@/lib/format";
import { useTx } from "@/lib/use-tx";
import { useVault } from "@/lib/use-vault";
import { cn } from "@/lib/utils";

const STEPS = ["Create vault", "Deposit", "Permissions"] as const;

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Which step the wizard is on, read from the chain so a reload never loses progress. */
export function wizardStep(v: ReturnType<typeof useVault>): 0 | 1 | 2 | 3 {
  if (!v.hasVault) return 0;
  if (!v.balance || v.balance === 0n) return 1;
  if (!v.policy || v.policy.agent === zeroAddress) return 2;
  return 3;
}

export function Wizard() {
  const v = useVault();
  const tx = useTx();
  const step = wizardStep(v);
  const [busy, setBusy] = useState(false);

  const [windowMin, setWindowMin] = useState("60");
  const [deposit, setDeposit] = useState("");
  const [agent, setAgent] = useState("");
  const [perRun, setPerRun] = useState("5000");
  const [perPayee, setPerPayee] = useState("1500");
  const [periodCap, setPeriodCap] = useState("10000");
  const [days, setDays] = useState("30");
  const [expiryDays, setExpiryDays] = useState("90");

  const run = async (f: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await f();
    } finally {
      setBusy(false);
    }
  };

  const createVault = () => {
    const mins = Number(windowMin);
    if (!Number.isFinite(mins) || mins < 0) return;
    return run(() =>
      tx("Create vault", { address: ADDRESSES.factory, abi: payrollVaultFactoryAbi, functionName: "createVault", args: [BigInt(Math.round(mins * 60))] }),
    );
  };

  const doDeposit = () => {
    const amount = parseAmount(deposit);
    if (!amount || amount === 0n || !v.vault) return;
    return run(async () => {
      const ok = await tx("Allow the vault to receive tUSD8", { address: ADDRESSES.tusd8, abi: erc20Abi, functionName: "approve", args: [v.vault!, amount] });
      if (ok) await tx(`Deposit ${deposit} ${TOKEN_SYMBOL}`, { address: v.vault!, abi: payrollVaultAbi, functionName: "deposit", args: [amount] });
    });
  };

  const agentValid = isAddress(agent);
  const setPolicy = () => {
    const [r, p, c] = [parseAmount(perRun), parseAmount(perPayee), parseAmount(periodCap)];
    if (!agentValid || !r || !p || !c || !v.policyAddress) return;
    const period = BigInt(Math.round(Number(days) * 86400));
    const expiry = BigInt(Math.floor(Date.now() / 1000) + Math.round(Number(expiryDays) * 86400));
    return run(() =>
      tx("Set assistant permissions", {
        address: v.policyAddress as Address,
        abi: agentSpendPolicyAbi,
        functionName: "setPolicy",
        args: [{ agent: agent as Address, perRun: r, perPayee: p, periodCap: c, period, expiry }],
      }),
    );
  };

  if (!v.isConnected) return null;
  if (step === 3) return null;

  return (
    <section aria-labelledby="wizard-title" className="rounded-2xl border border-border bg-card p-6 md:p-8">
      <p className="meta text-muted-foreground">Set up · step {step + 1} of 3</p>
      <h2 id="wizard-title" className="mt-2 text-[28px]">
        {["Create your payroll vault", "Fund the vault", "Decide what your assistant may do"][step]}
      </h2>

      <ol className="mt-5 flex gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === step ? "step" : undefined}
            className={cn("flex-1 border-t-2 pt-2 text-[12px]", i <= step ? "border-foreground text-foreground" : "border-border text-muted-foreground")}
          >
            {s}
          </li>
        ))}
      </ol>

      <div className="mt-6 grid max-w-md gap-5">
        {step === 0 && (
          <>
            <p className="text-[14px] text-muted-foreground">
              Your vault holds the money. Only you can approve a run, and every run waits for a review window first.
            </p>
            <Field id="window" label="Review window (minutes)" hint="How long a draft waits before you can sign. You can change this later.">
              <Input id="window" inputMode="numeric" value={windowMin} onChange={(e) => setWindowMin(e.target.value)} />
            </Field>
            <Button className="w-fit rounded-full" disabled={busy} onClick={createVault}>
              Create vault
            </Button>
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-[14px] text-muted-foreground">
              Move {TOKEN_SYMBOL} from your wallet into the vault. This takes two confirmations: allow, then deposit.
            </p>
            <Field id="deposit" label={`Amount (${TOKEN_SYMBOL})`}>
              <Input id="deposit" inputMode="decimal" placeholder="10000" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            </Field>
            <Button className="w-fit rounded-full" disabled={busy || !parseAmount(deposit)} onClick={doDeposit}>
              Deposit
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-[14px] text-muted-foreground">
              The assistant can only draft runs inside these limits. The contract refuses anything beyond them.
            </p>
            <Field id="agent" label="Assistant wallet address" hint={agent && !agentValid ? "That is not a full wallet address." : undefined}>
              <Input id="agent" placeholder="0x…" value={agent} onChange={(e) => setAgent(e.target.value.trim())} aria-invalid={!!agent && !agentValid} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field id="perRun" label={`Per run (${TOKEN_SYMBOL})`}>
                <Input id="perRun" inputMode="decimal" value={perRun} onChange={(e) => setPerRun(e.target.value)} />
              </Field>
              <Field id="perPayee" label="Per person">
                <Input id="perPayee" inputMode="decimal" value={perPayee} onChange={(e) => setPerPayee(e.target.value)} />
              </Field>
              <Field id="periodCap" label="Per period">
                <Input id="periodCap" inputMode="decimal" value={periodCap} onChange={(e) => setPeriodCap(e.target.value)} />
              </Field>
              <Field id="days" label="Period (days)">
                <Input id="days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
              </Field>
            </div>
            <Field id="expiry" label="Permission lasts (days)" hint="After this the assistant has no authority until you renew it.">
              <Input id="expiry" inputMode="numeric" value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} />
            </Field>
            <Button className="w-fit rounded-full" disabled={busy || !agentValid} onClick={setPolicy}>
              Save permissions
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

