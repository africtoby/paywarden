"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";
import { formatMoney } from "@/lib/format";
import { Sweep } from "@/components/sweep";

/** Counts a token amount up (or down) to its new value in about 600ms. First render shows the value as is. */
export function CountUp({ value, className }: { value: bigint; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (reduce || from.current === value) {
      from.current = value;
      queueMicrotask(() => setShown(value));
      return;
    }
    const start = Number(from.current);
    const end = Number(value);
    const controls = animate(0, 1, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (t) => setShown(BigInt(Math.round(start + (end - start) * t))),
      onComplete: () => setShown(value),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, reduce]);

  return <span className={className}>{formatMoney(shown)}</span>;
}

/** Same count-up, plus a gold underline flash when the amount goes up (a deposit). */
export function Balance({ value }: { value: bigint }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (value > prev.current) queueMicrotask(() => setFlash((n) => n + 1));
    prev.current = value;
  }, [value]);
  return (
    <Sweep value={flash}>
      <CountUp value={value} className="tnum" />
    </Sweep>
  );
}
