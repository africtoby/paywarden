"use client";

import { cn } from "@/lib/utils";

const R = 19;
const C = 2 * Math.PI * R;

/** A ring that drains as the review window runs out. `now`, `start` and `end` are unix seconds. */
export function ReviewRing({ now, start, end, className }: { now: number; start: number; end: number; className?: string }) {
  const total = Math.max(1, end - start);
  const left = Math.min(1, Math.max(0, (end - now) / total));
  return (
    <svg viewBox="0 0 44 44" aria-hidden className={cn("size-11 shrink-0 -rotate-90", className)}>
      <circle cx="22" cy="22" r={R} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2.5" />
      <circle
        cx="22"
        cy="22"
        r={R}
        fill="none"
        stroke="var(--gold)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - left)}
        style={{ transition: "stroke-dashoffset 1s linear" }}
      />
    </svg>
  );
}
