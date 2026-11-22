"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { buildPaths } from "@/components/seal";
import { cn } from "@/lib/utils";
import { easeOutCubic, mulberry, project, ringStrength, sampleAlongPaths } from "./motion-math";

/** The hero demo dispatches this on window when its run reaches PAID. */
export const PAID_EVENT = "paywarden:paid";

const COUNT = 3000;
// 3,000 points can only trace a few of the 18 guilloche curves; these keep the weave readable.
const CURVES = [0, 6, 12];
const FLY_IN = 1.8; // seconds each particle takes to land
const SPREAD = 0.9; // seconds over which the landings are staggered
const SWING = 0.5; // radians the seal turns either way around Y
const FOCAL = 3;

/**
 * Hero backdrop: about 2,500 gold particles fly in and assemble into our guilloche seal,
 * which then turns slowly in 3D. Plain canvas 2D, no three.js.
 */
export function ParticleSeal({ className, seed = "paywarden", tilt = true }: { className?: string; seed?: string; /** Follow the pointer. Off for small in-app uses. */ tilt?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pulseAt = useRef<number | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = canvas.current;
    const box = wrap.current;
    const ctx = el?.getContext("2d");
    if (!el || !box || !ctx) return;

    // Targets on the seal, scatter starts, and a little depth so the turn has volume.
    const rnd = mulberry(20241);
    const targets = sampleAlongPaths(buildPaths(seed, 200).filter((_, i) => CURVES.includes(i)), COUNT, 200, rnd);
    const parts = targets.map((t) => {
      const a = rnd() * Math.PI * 2;
      const r = 1.2 + rnd() * 1.4;
      return {
        tx: t.x,
        ty: t.y,
        tz: (rnd() - 0.5) * 0.08,
        sx: Math.cos(a) * r,
        sy: Math.sin(a) * r,
        sz: (rnd() - 0.5) * 2,
        delay: rnd() * SPREAD,
        size: 1.1 + rnd() * 1.1,
      };
    });

    let w = 0;
    let h = 0;
    let dpr = 1;
    let gold = "#cdb97e";
    let tiltX = 0;
    let tiltY = 0;
    let goalX = 0;
    let goalY = 0;
    let raf = 0;
    let visible = false;
    let start = 0;

    const resize = () => {
      w = box.clientWidth;
      h = box.clientHeight;
      if (!w || !h) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      gold = getComputedStyle(el).getPropertyValue("--gold").trim() || gold;
      if (reduce) frame(performance.now());
    };

    const frame = (now: number) => {
      if (!w || !h) return;
      const t = reduce ? 99 : (now - start) / 1000;
      const turn = reduce ? 0 : Math.sin(t * 0.22) * SWING;
      const R = Math.min(w, h) * 0.46 * dpr;
      const cx = (el.width) / 2;
      const cy = (el.height) / 2;
      const age = pulseAt.current === null ? -1 : (now - pulseAt.current) / 1000;
      if (age > 1.6) pulseAt.current = null;

      tiltX += (goalX - tiltX) * 0.05;
      tiltY += (goalY - tiltY) * 0.05;

      ctx.clearRect(0, 0, el.width, el.height);
      ctx.fillStyle = gold;
      ctx.globalAlpha = 0.85;
      const hot: [number, number, number][] = [];

      for (const p of parts) {
        const k = easeOutCubic((t - p.delay) / FLY_IN);
        let x = p.sx + (p.tx - p.sx) * k;
        let y = p.sy + (p.ty - p.sy) * k;
        const z = p.sz + (p.tz - p.sz) * k;
        let boost = 0;
        if (age >= 0) {
          boost = ringStrength(Math.hypot(p.tx, p.ty), age, 1.5, 0.22, 1.6);
          if (boost > 0.01) {
            const push = 1 + boost * 0.16;
            x *= push;
            y *= push;
          }
        }
        const q = project(x, y, z, turn + tiltY, tiltX, FOCAL);
        const px = cx + q.x * R;
        const py = cy + q.y * R;
        const s = p.size * q.scale * dpr;
        if (boost > 0.12) hot.push([px, py, s * (1 + boost * 1.6)]);
        else ctx.fillRect(px, py, s, s);
      }

      if (hot.length) {
        ctx.globalAlpha = 1;
        for (const [px, py, s] of hot) ctx.fillRect(px, py, s, s);
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      if (!visible) return;
      frame(now);
      raf = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible && !reduce) {
        // Keep the elapsed time when it comes back on screen.
        raf = requestAnimationFrame(loop);
      }
    });

    const move = (e: PointerEvent) => {
      goalY = (e.clientX / window.innerWidth - 0.5) * 0.18;
      goalX = (e.clientY / window.innerHeight - 0.5) * -0.14;
    };

    const pulse = () => {
      if (!reduce) pulseAt.current = performance.now();
    };

    start = performance.now();
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    io.observe(box);
    if (!reduce && tilt) window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener(PAID_EVENT, pulse);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", move);
      window.removeEventListener(PAID_EVENT, pulse);
    };
  }, [seed, reduce, tilt]);

  return (
    <div ref={wrap} aria-hidden className={cn("pointer-events-none", className)}>
      <canvas ref={canvas} className="size-full" />
    </div>
  );
}
