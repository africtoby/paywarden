import { Halftone } from "@/components/landing/halftone";
import { Balance } from "@/components/count-up";

/** The vault balance as a dark forest panel with a faint engraved texture behind it. */
export function BalanceCard({ balance, paused }: { balance: bigint; paused?: boolean }) {
  return (
    <section aria-labelledby="bal" className="panel-dark relative overflow-hidden rounded-2xl border border-border p-6 md:p-8">
      <Halftone tone="--gold" parallax={false} className="absolute -right-24 -top-24 size-[460px] opacity-[0.08]" />
      <div className="relative">
        <p id="bal" className="meta text-muted-foreground">
          Vault balance (tUSD8)
        </p>
        <p className="tnum mt-2 font-serif text-[56px] font-light leading-none tracking-[-0.02em]">
          <Balance value={balance} />
        </p>
        {paused && (
          <p role="status" className="mt-4 inline-block rounded-full bg-[var(--refused)]/15 px-3 py-1 text-[13px] text-[var(--refused)]">
            Vault paused. Nothing can be paid until you unpause.
          </p>
        )}
      </div>
    </section>
  );
}
