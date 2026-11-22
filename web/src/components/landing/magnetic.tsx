"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

const MAX = 6; // px
const REACH = 90; // px around the button that already pulls

/** Moves its child up to 6px toward the cursor, springs back on leave. Transform only. */
export function Magnetic({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 220, damping: 14, mass: 0.4 });
  const y = useSpring(my, { stiffness: 220, damping: 14, mass: 0.4 });

  const move = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1;
    const pull = Math.min(1, d / REACH);
    mx.set((dx / d) * MAX * pull);
    my.set((dy / d) * MAX * pull);
  };
  const leave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <motion.span ref={ref} className={className ?? "inline-block"} style={{ x, y }} onPointerMove={move} onPointerLeave={leave}>
      {children}
    </motion.span>
  );
}
