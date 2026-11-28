"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  /** Draw the signature like a pen stroke, then fill it in. */
  animate?: boolean;
  className?: string;
};

// The text is laid out at 100 units tall so the SVG scales with the font size of its parent.
const FONT = 100;
const BOX_H = 130;
const BASELINE = 88;
const DASH = 420;

/** The employer's handwritten signature on a signed run (Mrs Saint Delafield). */
export function SignatureMark({ name, animate = true, className }: Props) {
  const reduce = useReducedMotion();
  const play = animate && !reduce;
  const clipId = useId();
  const text = useRef<SVGTextElement>(null);
  const [width, setWidth] = useState(name.length * 38 + 24);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    const measure = () => {
      if (!live || !text.current) return;
      setWidth(Math.ceil(text.current.getComputedTextLength()) + 24);
      setReady(true);
    };
    // Measure once the script font is in, so the box never changes size after it draws.
    if (document.fonts?.ready) document.fonts.ready.then(measure);
    else measure();
    return () => {
      live = false;
    };
  }, [name]);

  const go = play && ready;
  const em = BOX_H / FONT;

  return (
    <svg
      role="img"
      aria-label={`Signed by ${name}`}
      viewBox={`0 0 ${width} ${BOX_H}`}
      className={cn("inline-block overflow-visible align-middle", className)}
      style={{ height: `${em}em`, width: `${(width / FONT).toFixed(3)}em` }}
    >
      <defs>
        <clipPath id={clipId}>
          <motion.rect
            x={0}
            y={-20}
            height={BOX_H + 40}
            initial={{ width: play ? 0 : width + 40 }}
            animate={{ width: go || !play ? width + 40 : 0 }}
            transition={{ duration: 1.05, ease: [0.45, 0, 0.25, 1] }}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <motion.text
          ref={text}
          x={12}
          y={BASELINE}
          fontSize={FONT}
          className="font-script"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={DASH}
          fill="currentColor"
          initial={{ strokeDashoffset: play ? DASH : 0, fillOpacity: play ? 0 : 1 }}
          animate={{
            strokeDashoffset: go || !play ? 0 : DASH,
            fillOpacity: go || !play ? 1 : 0,
          }}
          transition={{
            strokeDashoffset: { duration: 1.05, ease: [0.45, 0, 0.25, 1] },
            fillOpacity: { duration: 0.45, delay: 0.75 },
          }}
        >
          {name}
        </motion.text>
      </g>
    </svg>
  );
}
