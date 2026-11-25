"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { Seal } from "@/components/seal";
import { RevealHeading } from "./reveal-heading";

export type SlipData = { name: string; role: string; wallet: string; amount: string; tx?: string };

const SLIPS: SlipData[] = [
  { name: "Ada Okonkwo", role: "Product design", wallet: "0x7a3f91c2d0e4b8a6f1c35e7d9b2a4c6e8f0a91c2", amount: "600.00" },
  { name: "Kemi Adeyemi", role: "Frontend", wallet: "0x51be7c09a3d2f4e6b8c1a0d3e5f7b9c2d4e604d2", amount: "450.00" },
  { name: "Juan Reyes", role: "QA", wallet: "0x9c04e1f3a5b7d9c2e4f6a8b0c1d3e5f7a9b2e7f1", amount: "400.00" },
];
const TX = "0x4e1c9a07d2…b7a2";
const SLIP_LABEL = "Payslip · Nov";

const query = "(max-width: 767px)";
function useIsNarrow() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

function Slip({ i, n, s, p, narrow, label, spread }: { i: number; n: number; s: SlipData; p: MotionValue<number>; narrow: boolean; label: string; spread: number }) {
  const side = i - (n - 1) / 2; // -1, 0, 1 for three slips
  // Stacked at p = 0, fanned at p = 1. Desktop fans sideways in 3D, mobile fans downwards.
  const x = useTransform(p, [0, 1], [0, narrow ? side * 10 : side * spread]);
  const y = useTransform(p, [0, 1], [i * -4, narrow ? side * 182 : side * 6]);
  const rotateY = useTransform(p, [0, 1], [0, narrow ? 0 : side * -26]);
  const rotateZ = useTransform(p, [0, 1], [side * 2, narrow ? side * 2.5 : side * 7]);

  return (
    <motion.li
      className="absolute left-1/2 top-1/2 -ml-[150px] -mt-[100px] h-[200px] w-[300px] rounded-[18px] border border-[var(--mist)]/12 bg-[var(--forest-900)] p-5 text-[var(--mist)] [backface-visibility:hidden]"
      style={{ x, y, rotateY, rotateZ, zIndex: 10 - Math.round(Math.abs(side) * 2) }}
    >
      <div className="flex items-start justify-between">
        <Seal address={s.wallet} size={44} className="text-[var(--gold)]" />
        <span className="meta text-[var(--sage)]">{label}</span>
      </div>
      <p className="mt-4 font-serif text-[22px] leading-tight">{s.name}</p>
      <p className="text-[13px] text-[var(--sage)]">{s.role}</p>
      <div className="mt-3 flex items-baseline justify-between border-t border-[var(--mist)]/12 pt-3">
        <span className="font-mono text-[11px] text-[var(--sage)]">tx {s.tx ?? TX}</span>
        <span className="tnum font-serif text-[20px]">{s.amount}</span>
      </div>
    </motion.li>
  );
}

/** The fanned slips themselves. Progress 0 = stacked, 1 = fanned. Used on the landing page (scroll) and after a run is paid (time). */
export function PayslipStage({
  slips,
  progress,
  narrow,
  label = SLIP_LABEL,
  spread = 300,
  className,
}: {
  slips: readonly SlipData[];
  progress: MotionValue<number>;
  narrow: boolean;
  label?: string;
  /** Horizontal gap between slips when fanned, in px (before any scaling). */
  spread?: number;
  className?: string;
}) {
  return (
    <div className={className} style={{ perspective: 1200 }}>
      <ul className="absolute inset-0 m-0 list-none p-0" style={{ transformStyle: "preserve-3d" }} aria-label="Payslips">
        {slips.map((s, i) => (
          <Slip key={i} i={i} n={slips.length} s={s} p={progress} narrow={narrow} label={label} spread={spread} />
        ))}
      </ul>
    </div>
  );
}

export { useIsNarrow };

export function PayslipFan() {
  const reduce = useReducedMotion();
  const narrow = useIsNarrow();
  const stage = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: stage, offset: ["start 90%", "center 62%"] });
  const spring = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.5 });
  // Reduced motion: show the fanned end state. Set after mount so server and client markup match.
  const still = useMotionValue(0);
  useEffect(() => still.set(reduce ? 1 : 0), [reduce, still]);
  const p = useTransform([spring, still], ([s, d]: number[]) => (d ? 1 : s));

  return (
    <section className="mx-auto max-w-[1200px] px-5 py-24 md:px-10 md:py-32" aria-labelledby="fan">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <RevealHeading id="fan" className="max-w-xl text-[clamp(34px,4vw,48px)] leading-[1.05] tracking-[-0.02em]">
          Everyone paid in <em className="font-light text-[var(--forest-900)] dark:text-[var(--gold)]">one signature.</em>
        </RevealHeading>
        <p className="max-w-sm text-[16px] text-[var(--ink)]/68">One approval, one transaction, three payslips. Each carries the same hash, so anyone can check it.</p>
      </div>
      <div ref={stage} className="relative mt-10 h-[640px] md:h-[400px]">
        <PayslipStage slips={SLIPS} progress={p} narrow={narrow} className="absolute inset-0" />
      </div>
    </section>
  );
}
