/** Thin crosshair-style corner marks (12px, gold at 40%) that frame a window without touching layout. */
export function CornerMarks({ gap = 10 }: { gap?: number }) {
  const mark = "absolute size-3 border-[var(--gold)]/40";
  const o = -(gap + 12);
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      <span className={`${mark} border-l border-t`} style={{ left: o, top: o }} />
      <span className={`${mark} border-r border-t`} style={{ right: o, top: o }} />
      <span className={`${mark} border-b border-l`} style={{ left: o, bottom: o }} />
      <span className={`${mark} border-b border-r`} style={{ right: o, bottom: o }} />
    </span>
  );
}
