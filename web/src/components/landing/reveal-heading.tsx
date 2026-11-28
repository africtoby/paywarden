"use client";

import { Children, cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const LINE_STAGGER = 0.06; // seconds between lines

/**
 * Heading whose lines rise out of a mask, once, when it scrolls into view.
 * Words sit in overflow-hidden masks; lines are found by position so it survives wrapping.
 */
export function RevealHeading({
  as: Tag = "h2",
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  const [delays, setDelays] = useState<number[]>([]);

  // Reveal once the heading enters the view. A heading already on screen at load (the hero) is
  // revealed straight away: the library's in-view hook could miss it and leave the words hidden.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Group the words into visual lines and give each line its stagger.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const tops: number[] = [];
      const next = Array.from(el.querySelectorAll<HTMLElement>("[data-w]")).map((w) => {
        const top = w.offsetTop;
        let line = tops.findIndex((t) => Math.abs(t - top) < 4);
        if (line < 0) line = tops.push(top) - 1;
        return line * LINE_STAGGER;
      });
      setDelays((prev) => (prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Same markup on server and client; reduced motion just lands every word at once.
  const shown = seen || !!reduce;

  let n = 0;
  const split = (node: ReactNode): ReactNode =>
    Children.map(node, (child) => {
      if (typeof child === "string") {
        return child.split(/(\s+)/).map((part, k) => {
          if (!part) return null;
          if (/^\s+$/.test(part)) return " ";
          const i = n++;
          return (
            <span key={k} className="inline-block overflow-hidden pb-[0.14em] -mb-[0.14em] align-bottom">
              {/* A CSS transition, not a motion.span: the motion animation could stall on first load and leave the words hidden. */}
              <span
                data-w
                className="inline-block will-change-transform"
                style={{
                  transform: shown ? "translateY(0%)" : "translateY(110%)",
                  transition: reduce ? "none" : `transform 0.8s cubic-bezier(0.22, 1, 0.36, 1) ${delays[i] ?? 0}s`,
                }}
              >
                {part}
              </span>
            </span>
          );
        });
      }
      if (isValidElement<{ children?: ReactNode }>(child) && child.props.children) {
        return cloneElement(child, undefined, split(child.props.children));
      }
      return child;
    });

  return (
    <Tag ref={ref} className={className} {...rest}>
      {split(children)}
    </Tag>
  );
}
