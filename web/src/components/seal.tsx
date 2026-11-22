"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

// Guilloche maths adapted from design/directions.html (our own design file).

function seedFrom(address: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < address.length; i++) {
    h ^= address.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0 || 1;
}

export function buildPaths(address: string, size: number): string[] {
  let s = seedFrom(address.toLowerCase());
  const rnd = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
  const a = 3 + Math.floor(rnd() * 5);
  const b = 7 + Math.floor(rnd() * 9);
  const d = 0.18 + rnd() * 0.2;
  const R = size / 2;
  const steps = 240;
  const rings = [0.92, 0.68, 0.44];
  const out: string[] = [];
  rings.forEach((r, i) => {
    for (let k = 0; k < 6; k++) {
      let path = "";
      for (let n = 0; n <= steps; n++) {
        const th = (n / steps) * Math.PI * 2;
        const rr = r * R * (1 - d + d * Math.cos(b * th + (k * Math.PI) / 3 + i) * Math.cos(a * th));
        const x = R + rr * Math.cos(th);
        const y = R + rr * Math.sin(th);
        path += `${n ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      out.push(path);
    }
  });
  return out;
}

type SealProps = {
  /** Confirmed payee wallet. Omit for the dashed "not a confirmed payee" circle. */
  address?: string;
  size?: number;
  /** Draw the lines in (used when a payee has just confirmed). */
  animate?: boolean;
  /** Dashed circle breathes slowly: the payee is waiting to confirm. */
  breathe?: boolean;
  className?: string;
};

export function Seal({ address, size = 40, animate = false, breathe = false, className }: SealProps) {
  const reduce = useReducedMotion();
  const paths = useMemo(() => (address ? buildPaths(address, 100) : []), [address]);

  if (!address) {
    // Waiting for the payee: the dashed circle breathes slowly.
    return (
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={className}
        role="img"
        aria-label="Not a confirmed payee"
        animate={reduce || !breathe ? undefined : { opacity: [0.55, 1, 0.55], scale: [1, 1.05, 1] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="5 6" />
      </motion.svg>
    );
  }

  const seal = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={`Payee seal for ${address.slice(0, 6)}…${address.slice(-4)}`}
    >
      {paths.map((p, i) => (
        <motion.path
          key={i}
          d={p}
          fill="none"
          stroke={i >= 6 && i < 12 ? "var(--sage)" : "currentColor"}
          strokeOpacity={0.6}
          strokeWidth={0.6}
          initial={animate && !reduce ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, delay: i * 0.03, ease: "easeOut" }}
        />
      ))}
    </svg>
  );

  if (!animate || reduce) return seal;
  // Just confirmed: the dashed circle melts away while the seal draws in over it.
  return (
    <span className="relative inline-flex">
      {seal}
      <motion.svg
        aria-hidden
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: 0, scale: 1.12 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="5 6" />
      </motion.svg>
    </span>
  );
}
