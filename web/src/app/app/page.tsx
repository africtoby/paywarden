"use client";

import Link from "next/link";
import { WalletButton } from "@/components/wallet-button";
import { zeroAddress } from "viem";
import { AllowanceMeter } from "@/components/allowance-meter";
import { Wizard, wizardStep } from "@/components/wizard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { addressUrl } from "@/lib/chain";
import { formatAmount, formatDuration, shortAddress } from "@/lib/format";
import { useVault } from "@/lib/use-vault";
import { useTx } from "@/lib/use-tx";
import { payrollVaultAbi, TOKEN_SYMBOL } from "@/lib/contracts";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-border py-3 text-[14px] first:border-t-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

export default function Overview() {
  const v = useVault();
  const tx = useTx();

  if (!v.isConnected) {
    return (
      <div className="max-w-xl pt-10">
        <h1 className="text-[36px] leading-tight">Connect your wallet to open your vault.</h1>
        <p className="mt-3 text-[16px] text-muted-foreground">Use the wallet that owns the payroll. You stay in control of every payment.</p>
        <div className="mt-6">
          <WalletButton />
        </div>
      </div>
    );
  }

  if (v.loading) {
    return (
      <div aria-busy="true" className="grid gap-6 pt-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  const step = wizardStep(v);
  const hasAgent = !!v.policy && v.policy.agent !== zeroAddress;

  return (
    <div className="grid gap-8 pt-4">
      <section aria-labelledby="bal">
        <p id="bal" className="meta text-muted-foreground">
          Vault balance
        </p>
        <p className="tnum mt-1 font-serif text-[56px] font-light leading-none tracking-[-0.015em]">
          {formatAmount(v.balance ?? 0n)} <span className="text-[22px] text-muted-foreground">{TOKEN_SYMBOL}</span>
        </p>
        {v.paused && (
          <p role="status" className="mt-3 inline-block rounded-full bg-[var(--refused)]/10 px-3 py-1 text-[13px] text-[var(--refused)]">
            Vault paused. Nothing can be paid until you unpause.
          </p>
        )}
      </section>

      <Wizard />

      {step === 3 && v.policy && v.vault && (
        <div className="grid gap-6 md:grid-cols-2">
          <section aria-labelledby="allow" className="rounded-2xl border border-border bg-card p-6">
            <h2 id="allow" className="text-[22px]">
              Assistant allowance
            </h2>
            <div className="mt-4">
              {hasAgent ? <AllowanceMeter cap={v.policy.periodCap} remaining={v.remaining ?? 0n} /> : <p className="text-[14px] text-muted-foreground">No assistant set.</p>}
            </div>
            <div className="mt-4">
              <Row label="Per run">{formatAmount(v.policy.perRun)} {TOKEN_SYMBOL}</Row>
              <Row label="Per person">{formatAmount(v.policy.perPayee)} {TOKEN_SYMBOL}</Row>
              <Row label="Period">{formatDuration(Number(v.policy.period))}</Row>
              <Row label="Status">{v.revoked ? "Revoked" : "Active"}</Row>
            </div>
            <Link href="/app/assistant" className={buttonVariants({ variant: "outline", className: "mt-4 rounded-full" })}>
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
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => tx(v.paused ? "Unpause vault" : "Pause vault", { address: v.vault!, abi: payrollVaultAbi, functionName: v.paused ? "unpause" : "pause" })}
              >
                {v.paused ? "Unpause" : "Pause everything"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
