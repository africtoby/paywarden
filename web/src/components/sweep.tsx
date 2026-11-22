"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Wraps a value; when `value` changes (not on first render) a gold underline sweeps under it once. */
export function Sweep({ value, children, className }: { value: string | number | bigint; children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const prev = useRef(value);
  const [n, setN] = useState(0);

  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    queueMicrotask(() => setN((x) => x + 1));
  }, [value]);

  return (
    <span className={cn("relative inline-block", className)}>
      {children}
      {n > 0 && !reduce && (
        <motion.span
          key={n}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-0.5 h-0.5 origin-left bg-[var(--gold)]"
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 1, opacity: [1, 1, 0] }}
          transition={{ duration: 1.1, ease: "easeOut", opacity: { times: [0, 0.6, 1], duration: 1.1 } }}
        />
      )}
    </span>
  );
}
