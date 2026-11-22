"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type ChipKind = "awaiting" | "signed" | "refused" | "idle";

const STYLE: Record<ChipKind, string> = {
  awaiting: "bg-[var(--amber)]/20 text-[var(--amber-ink)]",
  signed: "bg-[var(--signed)]/15 text-[var(--signed)]",
  refused: "bg-[var(--refused)]/15 text-[var(--refused)]",
  idle: "bg-muted text-muted-foreground",
};

/** Run status pill: AWAITING in amber, SIGNED and PAID in green, REFUSED in red. Colour and text cross-fade when it changes. */
export function StatusChip({ kind, children, className }: { kind: ChipKind; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("meta inline-grid rounded-full px-3 py-1 transition-colors duration-300", STYLE[kind], className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={typeof children === "string" ? children : kind}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
