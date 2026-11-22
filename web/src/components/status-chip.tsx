import { cn } from "@/lib/utils";

export type ChipKind = "awaiting" | "signed" | "refused" | "idle";

const STYLE: Record<ChipKind, string> = {
  awaiting: "bg-[var(--amber)]/20 text-[var(--amber-ink)]",
  signed: "bg-[var(--signed)]/15 text-[var(--signed)]",
  refused: "bg-[var(--refused)]/15 text-[var(--refused)]",
  idle: "bg-muted text-muted-foreground",
};

/** Run status pill: AWAITING in amber, SIGNED in green, REFUSED in red. */
export function StatusChip({ kind, children, className }: { kind: ChipKind; children: React.ReactNode; className?: string }) {
  return <span className={cn("meta inline-block rounded-full px-3 py-1", STYLE[kind], className)}>{children}</span>;
}
