"use client";

import { Children, cloneElement, isValidElement, useLayoutEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

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
  const seen = useInView(ref, { once: true, amount: 0.4 });
  const [delays, setDelays] = useState<number[]>([]);

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
              <motion.span
                data-w
                className="inline-block will-change-transform"
                initial={{ y: "110%" }}
                animate={{ y: shown ? "0%" : "110%" }}
                transition={reduce ? { duration: 0 } : { duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: delays[i] ?? 0 }}
              >
                {part}
              </motion.span>
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
