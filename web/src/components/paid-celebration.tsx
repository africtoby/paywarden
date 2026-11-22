"use client";

import { useEffect } from "react";
import { animate, useMotionValue, useReducedMotion } from "framer-motion";
import { PayslipStage, type SlipData } from "@/components/landing/payslip-fan";

/** A small fan of the payslips just paid. Opens about half a second after the signature starts, done by 1.2s. */
export function PaidCelebration({ slips }: { slips: readonly SlipData[] }) {
  const reduce = useReducedMotion();
  const p = useMotionValue(0);
  useEffect(() => {
    if (reduce) {
      p.set(1);
      return;
    }
    const c = animate(p, 1, { duration: 0.7, delay: 0.5, ease: "easeOut" });
    return () => c.stop();
  }, [p, reduce]);

  return (
    <div aria-hidden className="relative h-[120px] w-full max-w-[380px]">
      <PayslipStage slips={slips.slice(0, 3)} progress={p} narrow={false} spread={210} label="Payslip" className="absolute inset-0 origin-center scale-[0.42] sm:scale-50" />
    </div>
  );
}
