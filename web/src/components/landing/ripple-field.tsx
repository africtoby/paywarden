"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ringStrength } from "./motion-math";

export type RippleHandle = {
  /** Start a ripple at a point in viewport coordinates. */
  fire: (clientX: number, clientY: number, tone: "refuse" | "pass") => void;
};

const LINES = 60;
const STEP = 8; // px between points along a line
const SPEED = 900; // px per second
const WIDTH = 110;
const LIFE = 1.5;
const BUCKETS = 5;
const TONES = { refuse: "238,143,161", pass: "205,185,126" } as const; // #EE8FA1, gold

/**
 * Fine engraved lines behind the trick demo. Drawn once and left alone; a ripple
 * (red when the contract refuses, soft gold when it passes) bends and tints them for ~1.5s.
 */
export function RippleField({ className, ref }: { className?: string; ref?: Ref<RippleHandle> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const fireRef = useRef<RippleHandle["fire"]>(() => {});

  useImperativeHandle(ref, () => ({ fire: (x, y, t) => fireRef.current(x, y, t) }));

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let base = "230,236,228";
    let raf = 0;
    let ripple: { x: number; y: number; at: number; tone: "refuse" | "pass" } | null = null;

    const lineY = (i: number, x: number) => {
      const gap = h / (LINES + 1);
      const y0 = gap * (i + 1);
      // Sine-modulated, with the swell slowly changing from one line to the next.
      return y0 + Math.sin(x * 0.011 + i * 0.35) * gap * 0.55 + Math.sin(x * 0.0043 - i * 0.12) * gap * 0.9;
    };

    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const age = ripple ? (now - ripple.at) / 1000 : -1;
      const active = ripple !== null && age <= LIFE;
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = `rgba(${base},0.11)`;

      if (!active) {
        ctx.beginPath();
        for (let i = 0; i < LINES; i++) {
          ctx.moveTo(0, lineY(i, 0));
          for (let x = STEP; x <= w + STEP; x += STEP) ctx.lineTo(x, lineY(i, x));
        }
        ctx.stroke();
        ripple = null;
        return false;
      }

      // Bucket the short segments by ripple strength so a frame is only a handful of strokes.
      const paths = Array.from({ length: BUCKETS }, () => new Path2D());
      const rx = ripple!.x;
      const ry = ripple!.y;
      for (let i = 0; i < LINES; i++) {
        let px = 0;
        let py = lineY(i, 0);
        for (let x = STEP; x <= w + STEP; x += STEP) {
          const y = lineY(i, x);
          const dist = Math.hypot(x - rx, y - ry);
          const s = ringStrength(dist, age, SPEED, WIDTH, LIFE);
          const dy = s * Math.sin(dist * 0.08 - age * 18) * 14;
          const b = Math.min(BUCKETS - 1, Math.floor(s * BUCKETS * 1.4));
          paths[b].moveTo(px, py);
          paths[b].lineTo(x, y + dy);
          px = x;
          py = y + dy;
        }
      }
      paths.forEach((p, b) => {
        const a = b === 0 ? 0.11 : 0.11 + (b / (BUCKETS - 1)) * 0.75;
        ctx.strokeStyle = `rgba(${b === 0 ? base : TONES[ripple!.tone]},${a})`;
        ctx.lineWidth = b === 0 ? 0.7 : 0.9;
        ctx.stroke(p);
      });
      return true;
    };

    const tick = (now: number) => {
      if (draw(now)) raf = requestAnimationFrame(tick);
    };

    const resize = () => {
      w = el.clientWidth;
      h = el.clientHeight;
      if (!w || !h) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      base = getComputedStyle(el).getPropertyValue("--mist-rgb").trim() || base;
      draw(performance.now());
    };

    fireRef.current = (cx, cy, tone) => {
      if (reduce) return;
      const r = el.getBoundingClientRect();
      ripple = { x: cx - r.left, y: cy - r.top, at: performance.now(), tone };
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      fireRef.current = () => {};
    };
  }, [reduce]);

  return <canvas ref={canvas} aria-hidden className={cn("pointer-events-none", className)} />;
}
