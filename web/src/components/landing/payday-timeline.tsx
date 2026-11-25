"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

const STEPS = [
  ["06:42", "Drafted", "Your assistant prepares the run from the timesheet."],
  ["06:43", "Checked 7/7", "The contract confirms every rule before anyone can sign."],
  ["07:58", "Signed", "You approve once the review window has passed."],
  ["07:58", "Paid", "tUSD8 lands in each confirmed wallet in the same block."],
] as const;

/** One payday, with a rail that fills as the reader scrolls through it. */
export function PaydayTimeline() {
  const ref = useRef<HTMLOListElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 55%"] });
  const fill = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <ol ref={ref} className="relative mt-12 grid gap-10 pl-10">
      <span className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--ink)]/12" aria-hidden />
      <motion.span
        className="absolute left-[7px] top-2 bottom-2 w-px origin-top bg-[var(--forest-900)]"
        style={{ scaleY: reduce ? 1 : fill }}
        aria-hidden
      />
      {STEPS.map(([t, s, d]) => (
        <li key={s} className="relative grid gap-1 md:grid-cols-[110px_190px_1fr] md:items-baseline">
          <span className="absolute -left-10 top-1.5 grid size-[15px] place-items-center rounded-full border border-[var(--forest-900)] bg-[var(--paper)]" aria-hidden>
            <span className="size-[5px] rounded-full bg-[var(--forest-900)]" />
          </span>
          <span className="tnum font-mono text-[13px] text-[var(--ink)]/68">{t}</span>
          <span className="font-serif text-[22px]">{s}</span>
          <span className="max-w-md text-[16px] text-[var(--ink)]/68">{d}</span>
        </li>
      ))}
    </ol>
  );
}
