"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { txUrl } from "@/lib/chain";
import { describeEvent } from "@/lib/describe-event";
import { shortHash } from "@/lib/format";
import type { VaultEvent } from "@/lib/use-logs";

const stamp = (ts: number, withDate: boolean) =>
  new Date(ts * 1000).toLocaleString(
    "en-GB",
    withDate ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" } : { hour: "2-digit", minute: "2-digit" },
  );

/** Vertical rail of events. Same look as the landing payday timeline, without the scroll effect. */
export function EventTimeline({
  events,
  label = (e) => describeEvent(e),
  withDate = true,
}: {
  events: readonly VaultEvent[];
  label?: (e: VaultEvent) => string;
  withDate?: boolean;
}) {
  // Rows present on first render stack in one after another as the rail grows; later arrivals slide in at the top.
  const [first] = useState<ReadonlySet<string>>(() => new Set(events.map((e) => e.txHash + e.logIndex)));
  return (
    <ol className="relative grid gap-6 pl-9">
      <motion.span
        className="absolute bottom-2 left-[7px] top-2 w-px origin-top bg-[var(--foreground)]/15"
        aria-hidden
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      {events.map((e, i) => {
        const k = e.txHash + e.logIndex;
        const loaded = first.has(k);
        return (
        <motion.li
          key={k}
          layout="position"
          initial={{ opacity: 0, y: loaded ? 6 : -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut", delay: loaded ? Math.min(i, 12) * 0.04 : 0 }}
          className="relative grid gap-1 md:grid-cols-[120px_1fr_auto] md:items-baseline md:gap-4"
        >
          <span
            className="absolute -left-9 top-1.5 grid size-[15px] place-items-center rounded-full border border-[var(--foreground)] bg-background"
            aria-hidden
          >
            <span className="size-[5px] rounded-full bg-[var(--foreground)]" />
          </span>
          <span className="tnum font-mono text-[13px] text-muted-foreground">{stamp(e.timestamp, withDate)}</span>
          <span className="text-[16px]">{label(e)}</span>
          <a
            href={txUrl(e.txHash)}
            target="_blank"
            rel="noreferrer"
            className="w-fit rounded font-mono text-[12px] text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {shortHash(e.txHash)}
          </a>
        </motion.li>
        );
      })}
    </ol>
  );
}
