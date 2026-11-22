"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { Seal } from "@/components/seal";
import { SignatureMark } from "@/components/signature-mark";
import { CHECK_LABELS } from "@/lib/demo-rules";

const LINES = [
  { name: "Ada Okonkwo", role: "Product design, 40 h", wallet: "0x7a3f91c2d0e4b8a6f1c35e7d9b2a4c6e8f0a91c2", amount: "600.00" },
  { name: "Kemi Adeyemi", role: "Frontend, 30 h", wallet: "0x51be7c09a3d2f4e6b8c1a0d3e5f7b9c2d4e604d2", amount: "450.00" },
  { name: "Juan Reyes", role: "QA, 32 h", wallet: "0x9c04e1f3a5b7d9c2e4f6a8b0c1d3e5f7a9b2e7f1", amount: "400.00" },
];

// When each phase starts, in ms after play.
const AT = { lines: 300, checks: 1500, review: 2300, sign: 3900, paid: 4900 } as const;
type Phase = "idle" | keyof typeof AT;
const ORDER: Phase[] = ["idle", "lines", "checks", "review", "sign", "paid"];
const reached = (p: Phase, q: Phase) => ORDER.indexOf(p) >= ORDER.indexOf(q);

export function HeroDemo() {
  const reduce = useReducedMotion();
  const [played, setPhase] = useState<Phase>("idle");
  const [left, setLeft] = useState(3);
  const [run, setRun] = useState(0);
  const timers = useRef<number[]>([]);
  // With reduced motion the finished run is shown straight away.
  const phase: Phase = reduce ? "paid" : played;

  const play = useCallback(() => {
    timers.current.forEach(clearTimeout);
    const at = (ms: number, fn: () => void) => window.setTimeout(fn, ms);
    timers.current = [
      at(0, () => {
        setPhase("idle");
        setLeft(3);
      }),
      ...(Object.keys(AT) as (keyof typeof AT)[]).map((k) => at(AT[k], () => setPhase(k))),
      // Review countdown 3 → 0 while the review phase is showing.
      ...[1, 2, 3].map((n) => at(AT.review + n * 480, () => setLeft(3 - n))),
    ];
  }, []);

  useEffect(() => {
    if (reduce) return;
    play();
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, [reduce, play, run]);

  const status = reached(phase, "paid") ? "PAID" : reached(phase, "sign") ? "SIGNED" : reached(phase, "checks") ? "AWAITING" : "DRAFTING";
  const statusCls =
    status === "PAID" || status === "SIGNED" ? "text-[#7fbf9a] bg-[#7fbf9a]/12" : status === "AWAITING" ? "text-[var(--amber)] bg-[var(--amber)]/12" : "text-[var(--sage)] bg-[var(--mist)]/8";

  return (
    <figure className="relative rounded-[28px] border border-[var(--mist)]/10 bg-[var(--forest-900)] p-2" aria-label="Example pay run, animated">
      <div className="rounded-[22px] border border-[var(--mist)]/10 bg-[var(--forest-950)]">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--mist)]/10 px-5 py-3">
          <span className="font-serif text-[15px] text-[var(--mist)]">November payroll</span>
          <div className="flex items-center gap-3">
            <span className={`meta rounded-full px-2.5 py-1 transition-colors duration-300 ${statusCls}`}>{status}</span>
            <button
              type="button"
              onClick={() => setRun((n) => n + 1)}
              className="grid size-7 place-items-center rounded-full text-[var(--sage)] transition-colors hover:bg-[var(--mist)]/10 hover:text-[var(--mist)] focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
              aria-label="Replay the example run"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-[1.25fr_1fr]">
          <div className="border-[var(--mist)]/10 p-5 md:border-r">
            <p className="text-[13px] text-[var(--sage)]">Drafted by your assistant from the timesheet</p>
            <ul className="mt-3">
              {LINES.map((l, i) => (
                <motion.li
                  key={l.name}
                  className="flex items-center gap-3 border-t border-[var(--mist)]/8 py-3 first:border-t-0"
                  initial={false}
                  animate={reached(phase, "lines") ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                  transition={{ delay: reduce ? 0 : i * 0.18, duration: 0.35 }}
                >
                  <Seal address={l.wallet} size={30} className="shrink-0 text-[var(--gold)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-[16px] text-[var(--mist)]">{l.name}</span>
                    <span className="block truncate text-[12px] text-[var(--sage)]">{l.role}</span>
                  </span>
                  <span className="tnum font-serif text-[16px] text-[var(--mist)]">{l.amount}</span>
                </motion.li>
              ))}
            </ul>
            <div className="mt-2 flex items-baseline justify-between border-t border-[var(--mist)]/15 pt-3">
              <span className="text-[13px] text-[var(--sage)]">Total, tUSD8</span>
              <span className="tnum font-serif text-[22px] text-[var(--mist)]">1,450.00</span>
            </div>
          </div>

          <div className="flex flex-col p-5">
            <ul className="grid gap-1.5" aria-label="Checks the contract runs">
              {CHECK_LABELS.map((c, i) => {
                const on = reached(phase, "checks");
                return (
                  <li key={c} className="flex items-center justify-between gap-3 font-mono text-[11.5px]">
                    <span className="min-w-0 truncate text-[var(--mist)]/80">{c}</span>
                    <motion.span
                      initial={false}
                      animate={on ? { opacity: 1, scale: 1 } : { opacity: 0.25, scale: 0.9 }}
                      transition={{ delay: reduce ? 0 : i * 0.08, duration: 0.2 }}
                      className={on ? "text-[#7fbf9a]" : "text-[var(--sage)]"}
                    >
                      {on ? "PASS" : "····"}
                    </motion.span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 min-h-[92px] flex-1 rounded-2xl border border-dashed border-[var(--mist)]/15 p-4">
              <AnimatePresence mode="wait">
                {phase === "review" && (
                  <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <p className="text-[12px] text-[var(--sage)]">Review window closes in</p>
                    <p className="tnum mt-1 font-serif text-[30px] text-[var(--amber)]">00:0{left}</p>
                  </motion.div>
                )}
                {reached(phase, "sign") && (
                  <motion.div key="signed" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-[12px] text-[var(--sage)]">Signed by the employer</p>
                    <SignatureMark key={run} name="Ama Mensah" animate={!reduce} className="mt-1 text-[40px] text-[var(--gold)]" />
                    <motion.p
                      initial={false}
                      animate={{ opacity: reached(phase, "paid") ? 1 : 0 }}
                      className="mt-1 font-mono text-[11px] text-[var(--sage)]"
                    >
                      Paid · tx 0x4e1c…b7a2 · example
                    </motion.p>
                  </motion.div>
                )}
                {!reached(phase, "review") && (
                  <motion.p key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[12px] text-[var(--sage)]">
                    Nothing moves until you sign.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
