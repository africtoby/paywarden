"use client";

import { EventTimeline } from "@/components/event-timeline";
import { Skeleton } from "@/components/ui/skeleton";
import { useVaultEvents } from "@/lib/use-logs";
import { useVault } from "@/lib/use-vault";

function ActivitySkeleton() {
  return (
    <div aria-busy="true" className="pt-4">
      <Skeleton className="h-12 w-56" />
      <Skeleton className="mt-3 h-5 w-full max-w-md" />
      <div className="mt-8 grid gap-6 pl-9">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const v = useVault();
  const events = useVaultEvents(v.vault, v.policyAddress);

  if (!v.isConnected) return <p className="pt-10 text-[16px] text-muted-foreground">Connect your wallet to see activity.</p>;
  if (v.loading || events.isLoading) return <ActivitySkeleton />;
  if (!v.hasVault) return <p className="pt-10 text-[16px] text-muted-foreground">Create your vault on the Overview page first.</p>;

  const list = [...(events.data ?? [])].reverse();

  return (
    <div className="pt-4">
      <h1 className="page-title">
        Everything that <em>happened.</em>
      </h1>
      <p className="mt-2 text-[16px] text-muted-foreground">Every action in your vault, straight from the chain.</p>
      {events.isError && <p role="alert" className="mt-4 text-[14px] text-[var(--refused)]">Could not load activity. Check your connection and reload.</p>}
      {list.length === 0 ? (
        <p className="mt-8 text-[14px] text-muted-foreground">Nothing yet. Actions appear here as they happen.</p>
      ) : (
        <div className="mt-8">
          <EventTimeline events={list} />
        </div>
      )}
    </div>
  );
}
