"use client";

import { useId, useState } from "react";
import { Seal } from "@/components/seal";
import { SignatureMark } from "@/components/signature-mark";

/** How it works, shown as three working fragments of the product instead of numbered text. */
export function HowPanels() {
  const id = useId();
  const [name, setName] = useState("Ada Okonkwo");
  const seed = name.trim().toLowerCase();

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3">
      <article className="flex flex-col rounded-[22px] border border-[var(--ink)]/8 bg-[var(--paper-2)] p-6">
        <h3 className="text-[26px]">Invite</h3>
        <p className="mt-2 text-[15px] text-[var(--ink)]/65">
          Each payee confirms with their own wallet and gets a seal drawn from it. Same wallet, same seal, every payday.
        </p>
        <div className="mt-auto pt-6">
          <label htmlFor={id} className="text-[13px] text-[var(--ink)]/55">
            Type a name to draw its seal
          </label>
          <div className="mt-2 flex items-center gap-4">
            <Seal key={seed} address={seed || undefined} size={72} animate className="shrink-0 text-[var(--forest-900)]" />
            <input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              placeholder="Kemi Adeyemi"
              className="min-w-0 flex-1 rounded-full border border-[var(--ink)]/15 bg-transparent px-4 py-2 font-serif text-[17px] outline-none transition-colors focus:border-[var(--forest-900)]"
            />
          </div>
        </div>
      </article>

      <article className="flex flex-col rounded-[22px] border border-[var(--ink)]/8 bg-[var(--paper-2)] p-6">
        <h3 className="text-[26px]">Draft</h3>
        <p className="mt-2 text-[15px] text-[var(--ink)]/65">
          Your assistant reads the timesheet and drafts the run. It can only propose. It can never approve or pay.
        </p>
        <div className="mt-auto pt-6">
          <div className="flex items-center justify-between rounded-2xl bg-[var(--forest-950)] px-4 py-3.5 text-[var(--mist)]">
            <span className="font-serif text-[16px]">Pay 3 for November</span>
            <span className="meta rounded-full bg-[var(--amber)]/12 px-2.5 py-1 text-[var(--amber)]">Awaiting</span>
          </div>
        </div>
      </article>

      <article className="flex flex-col rounded-[22px] border border-[var(--ink)]/8 bg-[var(--paper-2)] p-6">
        <h3 className="text-[26px]">Sign</h3>
        <p className="mt-2 text-[15px] text-[var(--ink)]/65">
          The contract checks every draft against your limits. You review it, sign once, and everyone is paid.
        </p>
        <div className="mt-auto pt-6">
          <div className="border-b border-[var(--ink)]/20 pb-1">
            <SignatureMark name="Ama Mensah" animate={false} className="text-[44px] text-[var(--forest-900)]" />
          </div>
          <p className="mt-2 font-mono text-[11px] text-[var(--ink)]/50">Signed · 1,450 tUSD8 paid</p>
        </div>
      </article>
    </div>
  );
}
