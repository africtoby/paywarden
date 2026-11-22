import { formatAmount } from "@/lib/format";
import { TOKEN_SYMBOL } from "@/lib/contracts";

/** Slim bar showing how much of the assistant's allowance for this period is used. */
export function AllowanceMeter({ cap, remaining }: { cap: bigint; remaining: bigint }) {
  const used = cap > remaining ? cap - remaining : 0n;
  const pct = cap === 0n ? 0 : Number((used * 10000n) / cap) / 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[14px]">
        <span className="tnum">
          {formatAmount(used)} of {formatAmount(cap)} {TOKEN_SYMBOL}
        </span>
        <span className="meta text-muted-foreground">{Math.round(pct)}% used</span>
      </div>
      <div
        role="progressbar"
        aria-label="Assistant allowance used this period"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
