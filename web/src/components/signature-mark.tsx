"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  /** Write the signature on from left to right. */
  animate?: boolean;
  className?: string;
};

/** The employer's handwritten signature on a signed run (Mrs Saint Delafield). */
export function SignatureMark({ name, animate = true, className }: Props) {
  const reduce = useReducedMotion();
  const play = animate && !reduce;
  return (
    <motion.span
      className={cn("inline-block font-script leading-none whitespace-nowrap", className)}
      initial={play ? { clipPath: "inset(-20% 100% -20% 0)" } : false}
      animate={{ clipPath: "inset(-20% 0% -20% 0)" }}
      transition={{ duration: 0.9, ease: [0.45, 0, 0.2, 1] }}
      aria-label={`Signed by ${name}`}
    >
      {name}
    </motion.span>
  );
}
