"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { buildPaths } from "@/components/seal";
import { cn } from "@/lib/utils";

/**
 * Engraved halftone backdrop: our guilloche rosette re-printed as a dot screen,
 * the way banknote engravings are reproduced. Drawn once per resize on canvas.
 */
export function Halftone({ seed = "paywarden", className }: { seed?: string; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 60, damping: 20 });
  const y = useSpring(my, { stiffness: 60, damping: 20 });

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;

    const draw = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      const ctx = el.getContext("2d");
      if (!ctx) return;

      // 1. Render the rosette softly into a small offscreen source image.
      const S = 260;
      const src = document.createElement("canvas");
      src.width = S;
      src.height = S;
      const s = src.getContext("2d", { willReadFrequently: true });
      if (!s) return;
      s.filter = "blur(2.2px)";
      s.strokeStyle = "#fff";
      s.lineWidth = 2.4;
      for (const d of buildPaths(seed, S)) s.stroke(new Path2D(d));
      const px = s.getImageData(0, 0, S, S).data;

      // 2. Sample it on a dot grid: brighter source = bigger dot.
      const gold = getComputedStyle(el).getPropertyValue("--gold").trim() || "#cdb97e";
      ctx.clearRect(0, 0, el.width, el.height);
      ctx.fillStyle = gold;
      const step = 6 * dpr;
      const size = Math.min(el.width, el.height);
      const ox = (el.width - size) / 2;
      const oy = (el.height - size) / 2;
      for (let gy = 0; gy < size; gy += step) {
        for (let gx = 0; gx < size; gx += step) {
          const sx = Math.floor((gx / size) * S);
          const sy = Math.floor((gy / size) * S);
          const lum = px[(sy * S + sx) * 4 + 3] / 255;
          if (lum < 0.06) continue;
          ctx.beginPath();
          ctx.arc(ox + gx, oy + gy, (step / 2) * Math.min(1, lum * 1.15), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => ro.disconnect();
  }, [seed]);

  useEffect(() => {
    if (reduce) return;
    const move = (e: PointerEvent) => {
      mx.set((e.clientX / window.innerWidth - 0.5) * -12);
      my.set((e.clientY / window.innerHeight - 0.5) * -12);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [reduce, mx, my]);

  return (
    <motion.div aria-hidden className={cn("pointer-events-none", className)} style={{ x, y }}>
      <canvas ref={canvas} className="size-full" />
    </motion.div>
  );
}
