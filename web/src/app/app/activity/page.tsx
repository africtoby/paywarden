"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { txUrl } from "@/lib/chain";
import { formatAmount, shortAddress, shortHash } from "@/lib/format";
import { useVaultEvents, type VaultEvent } from "@/lib/use-logs";
import { useVault } from "@/lib/use-vault";

/** One plain-English line per on-chain event. */
function describe(e: VaultEvent): string {
  const a = e.args;
  switch (e.name) {
    case "Deposited": return `Deposited ${formatAmount(a.amount as bigint)} tUSD8`;
    case "Withdrawn": return `Withdrew ${formatAmount(a.amount as bigint)} tUSD8`;
    case "ReviewWindowSet": return "Review window changed";
    case "PayeeInvited": return "Payee invited";
    case "PayeeConfirmed": return `Payee confirmed with ${shortAddress(String(a.wallet))}`;
    case "AgentIdentityRegistered": return "Assistant identity registered";
    case "RunProposed": return `Assistant drafted a run of ${formatAmount(a.total as bigint)} tUSD8`;
    case "RunApproved": return "You approved a run";
    case "RunCancelled": return "You cancelled a run";
    case "RunExecuted": return `Run paid: ${formatAmount(a.total as bigint)} tUSD8 to ${String(a.payees)} people`;
    case "PayeePaid": return `Paid ${formatAmount(a.amount as bigint)} tUSD8 to ${shortAddress(String(a.wallet))}`;
    case "PolicySet": return "Assistant permissions saved";
    case "PolicyRevokedByOwner": return "Assistant switched off";
    case "SpendRecorded": return "Spend recorded against the allowance";
    case "Paused": return "Vault paused";
    case "Unpaused": return "Vault unpaused";
    default: return e.name.replace(/([a-z])([A-Z])/g, "$1 $2");
  }
}

export default function ActivityPage() {
  const v = useVault();
  const events = useVaultEvents(v.vault, v.policyAddress);

  if (!v.isConnected) return <p className="pt-10 text-[16px] text-muted-foreground">Connect your wallet to see activity.</p>;
  if (v.loading || events.isLoading) {
    return (
      <div aria-busy="true" className="grid gap-3 pt-6">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }
  if (!v.hasVault) return <p className="pt-10 text-[16px] text-muted-foreground">Create your vault on the Overview page first.</p>;

  const list = [...(events.data ?? [])].reverse();

  return (
    <div className="pt-4">
      <h1 className="page-title">Activity</h1>
      <p className="mt-2 text-[16px] text-muted-foreground">Everything that happened in your vault, straight from the chain.</p>
      {events.isError && <p role="alert" className="mt-4 text-[14px] text-[var(--refused)]">Could not load activity. Check your connection and reload.</p>}
      {list.length === 0 ? (
        <p className="mt-6 text-[14px] text-muted-foreground">Nothing yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {list.map((e) => (
            <li key={e.txHash + e.logIndex} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3.5">
              <span className="meta w-[110px] shrink-0 text-muted-foreground">
                {new Date(e.timestamp * 1000).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="min-w-0 flex-1 text-[14px]">{describe(e)}</span>
              <a href={txUrl(e.txHash)} target="_blank" rel="noreferrer" className="font-mono text-[12px] text-muted-foreground underline-offset-4 hover:underline">
                {shortHash(e.txHash)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
