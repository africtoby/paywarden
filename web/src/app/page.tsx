import Link from "next/link";
import { Seal } from "@/components/seal";
import { buttonVariants } from "@/components/ui/button";

const CHECKS = [
  "Confirmed payee",
  "Per-person cap",
  "Per-run cap",
  "Monthly cap",
  "Assistant not expired",
  "Vault not paused",
  "Not already paid",
];

const STEPS = [
  ["Invite", "Add each payee by name. They confirm with their own wallet, so you only ever pay people who vouched for their address."],
  ["Draft", "Your assistant reads a timesheet and drafts a run. It can only propose. It can never approve or pay."],
  ["Sign", "The contract checks every draft. You review it, then sign once and everyone is paid."],
];

const TIMELINE = [
  ["06:42", "Drafted", "The assistant prepares the run from the timesheet."],
  ["06:43", "Checked (7/7)", "The contract confirms every rule."],
  ["07:58", "Signed", "You approve after the review window."],
  ["07:58", "Paid", "tUSD8 reaches each confirmed wallet."],
];

export default function Landing() {
  return (
    <div className="bg-[var(--paper)] text-[var(--ink)]">
      <section className="bg-[var(--forest-950)] text-[var(--mist)]">
        <div className="relative mx-auto max-w-[1200px] overflow-hidden px-5 pb-20 pt-6 md:px-10">
          <Seal address="0xpaywarden-hero-rosette" size={760} className="pointer-events-none absolute -right-48 -top-40 hidden text-[var(--gold)] opacity-20 md:block" />
          <header className="relative flex items-center justify-between">
            <span className="font-serif text-[22px]">PayWarden</span>
            <Link href="/app" className={buttonVariants({ variant: "outline", className: "rounded-full border-[var(--mist)]/30 bg-transparent text-[var(--mist)] hover:bg-[var(--mist)]/10" })}>
              Launch app
            </Link>
          </header>

          <div className="relative mt-20 max-w-3xl md:mt-28">
            <p className="meta text-[var(--sage)]">Stablecoin payroll · Aevum testnet</p>
            <h1 className="mt-4 text-[44px] leading-[1.05] md:text-[56px]">
              Payroll your AI prepares.
              <br />
              <em className="font-light">Only you can sign.</em>
            </h1>
            <p className="mt-5 max-w-xl text-[18px] text-[var(--mist)]/75">
              An assistant drafts each pay run. A contract checks it against limits you set. Nothing moves until you sign.
            </p>
            <Link href="/app" className={buttonVariants({ size: "lg", className: "mt-8 rounded-full bg-[var(--gold)] px-7 text-[var(--forest-950)] hover:bg-[var(--gold-soft)]" })}>
              Launch app
            </Link>
          </div>

          <div className="relative mt-16 rounded-[24px] border border-[var(--mist)]/12 bg-[var(--forest-900)] p-5 md:p-8" aria-label="Product preview">
            <p className="meta text-[var(--sage)]">Your assistant drafts. You sign.</p>
            <div className="mt-4 divide-y divide-[var(--mist)]/12">
              {[
                ["Pay 3 contractors for November", "1,450 tUSD8", "AWAITING", "text-[var(--amber)]"],
                ["Pay 2 contractors for October", "980 tUSD8", "SIGNED", "text-[#7fbf9a]"],
              ].map(([t, a, s, c]) => (
                <div key={t} className="flex flex-wrap items-center gap-x-6 gap-y-1 py-3.5">
                  <span className="min-w-0 flex-1 font-serif text-[18px]">{t}</span>
                  <span className="tnum font-serif text-[18px]">{a}</span>
                  <span className={`meta ${c}`}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 py-24 md:px-10" aria-labelledby="how">
        <h2 id="how" className="text-[36px]">How it works</h2>
        <ol className="mt-10 divide-y divide-[var(--ink)]/10 border-y border-[var(--ink)]/10">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="grid gap-2 py-7 md:grid-cols-[80px_220px_1fr]">
              <span className="meta text-[var(--ink)]/36">0{i + 1}</span>
              <h3 className="text-[28px]">{t}</h3>
              <p className="max-w-xl text-[16px] text-[var(--ink)]/65">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-[var(--forest-900)] text-[var(--mist)]" aria-labelledby="checks">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-24 md:grid-cols-2 md:px-10">
          <div>
            <h2 id="checks" className="text-[36px]">Seven checks, enforced by the contract.</h2>
            <p className="mt-4 max-w-md text-[16px] text-[var(--mist)]/70">
              Not a promise from software. The rules live on-chain, so even a tricked assistant cannot pay past them.
            </p>
          </div>
          <ul>
            {CHECKS.map((c) => (
              <li key={c} className="flex items-center justify-between border-t border-[var(--mist)]/12 py-3 font-mono text-[13px] first:border-t-0">
                <span>{c}</span>
                <span className="text-[#7fbf9a]">PASS</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 py-24 md:px-10" aria-labelledby="day">
        <h2 id="day" className="text-[36px]">One payday morning</h2>
        <ol className="mt-10 grid gap-0 border-l border-[var(--ink)]/15">
          {TIMELINE.map(([t, s, d]) => (
            <li key={s} className="relative grid gap-1 pb-8 pl-8 md:grid-cols-[100px_200px_1fr]">
              <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-[var(--forest-900)]" aria-hidden />
              <span className="meta text-[var(--ink)]/55">{t}</span>
              <span className="meta">{s}</span>
              <span className="text-[16px] text-[var(--ink)]/65">{d}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 pb-24 md:px-10" aria-labelledby="open">
        <h2 id="open" className="text-[36px]">Open source, on testnet</h2>
        <dl className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            ["Network", "QDay Aevum Testnet"],
            ["Token", "tUSD8, 6 decimals"],
            ["Licence", "MIT, contracts verified on the explorer"],
          ].map(([k, v]) => (
            <div key={k} className="border-t border-[var(--ink)]/10 pt-4">
              <dt className="meta text-[var(--ink)]/55">{k}</dt>
              <dd className="mt-1 font-serif text-[22px]">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="border-t border-[var(--ink)]/10 px-5 py-8 text-center text-[13px] text-[var(--ink)]/55">
        PayWarden · Aevum Builder Challenge · Test funds only
      </footer>
    </div>
  );
}
