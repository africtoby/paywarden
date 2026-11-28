import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ParticleSeal } from "@/components/landing/particle-seal";
import { RevealHeading } from "@/components/landing/reveal-heading";
import { Magnetic } from "@/components/landing/magnetic";
import { PayslipFan } from "@/components/landing/payslip-fan";
import { HeroDemo } from "@/components/landing/hero-demo";
import { TrickDemo } from "@/components/landing/trick-demo";
import { HowPanels } from "@/components/landing/how-panels";
import { PaydayTimeline } from "@/components/landing/payday-timeline";
import { ChainPulse } from "@/components/landing/chain-pulse";

const GITHUB = "https://github.com/africtoby/paywarden";
const DORAHACKS = "https://dorahacks.io/hackathon/qday/detail";
const EXPLORER = "https://explorer-test.qday.info";

// Structured data so search engines know what the site is.
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "PayWarden",
  url: "https://www.paywarden.me",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "Payroll an AI assistant prepares and only you can sign. The assistant drafts pay runs in stablecoins, a smart contract on QDay Aevum checks them against your limits, and nothing moves until you approve.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: { "@type": "Person", name: "Toby", url: "https://github.com/africtoby" },
  sameAs: ["https://github.com/africtoby/paywarden", "https://youtu.be/EGevjYKSC4A"],
};

const goldCta =
  "relative h-12 overflow-hidden rounded-full bg-[var(--gold)] px-7 text-[16px] text-[var(--forest-950)] before:absolute before:inset-0 before:-translate-x-full before:bg-[var(--gold-soft)] before:transition-transform before:duration-500 before:ease-out hover:bg-[var(--gold)] hover:before:translate-x-0 [&>span]:relative";

export default function Landing() {
  return (
    <div className="bg-[var(--paper)] text-[var(--ink)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <noscript>
        <style>{"[data-w]{transform:none!important}"}</style>
      </noscript>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[var(--forest-950)] text-[var(--mist)]">
        <ParticleSeal className="absolute -right-[14%] -top-[18%] size-[min(980px,95vw)] opacity-70" />
        <div className="relative mx-auto max-w-[1200px] px-5 pb-20 pt-6 md:px-10 md:pb-28">
          <header className="flex items-center justify-between">
            <span className="font-serif text-[22px]">PayWarden</span>
            <nav className="flex items-center gap-6 text-[14px] text-[var(--mist)]/70">
              <a href="#trick" className="hidden transition-colors hover:text-[var(--mist)] sm:inline">Try to trick it</a>
              <a href={GITHUB} target="_blank" rel="noreferrer" className="hidden transition-colors hover:text-[var(--mist)] sm:inline">Source</a>
              <Link href="/app" className={buttonVariants({ variant: "outline", className: "rounded-full border-[var(--mist)]/25 bg-transparent px-4 text-[var(--mist)] hover:bg-[var(--mist)]/10 hover:text-[var(--mist)]" })}>
                Launch app
              </Link>
            </nav>
          </header>

          <div className="mt-20 grid gap-14 lg:mt-24 lg:grid-cols-[1fr_minmax(0,560px)] lg:items-center">
            <div>
              <RevealHeading as="h1" className="text-[clamp(48px,7.2vw,88px)] leading-[0.98] tracking-[-0.03em] [text-wrap:balance]">
                Payroll your AI prepares.{" "}
                <em className="font-light text-[var(--gold)]">Only you can sign.</em>
              </RevealHeading>
              <p className="mt-7 max-w-[34rem] text-[18px] leading-relaxed text-[var(--mist)]/72">
                An assistant drafts each pay run in tUSD8. A contract on Aevum checks it against limits you set. Nothing moves until you sign.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-5">
                <Magnetic>
                  <Link href="/app" className={buttonVariants({ className: goldCta })}>
                    <span>Launch app</span>
                  </Link>
                </Magnetic>
                <Link href="/try" className="inline-flex h-12 items-center rounded-full border border-[var(--mist)]/30 px-6 text-[16px] text-[var(--mist)] transition-colors hover:border-[var(--gold)] hover:bg-[var(--mist)]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]">
                  Try it without a wallet
                </Link>
                <a href="#trick" className="text-[15px] text-[var(--mist)]/75 underline decoration-[var(--mist)]/25 underline-offset-[6px] transition-colors hover:text-[var(--mist)] hover:decoration-[var(--gold)]">
                  Watch it refuse a bad draft
                </a>
              </div>
            </div>
            <HeroDemo />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-[1200px] px-5 py-24 md:px-10 md:py-32" aria-labelledby="how">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <RevealHeading id="how" className="max-w-xl text-[clamp(34px,4vw,48px)] leading-[1.05] tracking-[-0.02em]">
            Three moves, and only one of them is yours.
          </RevealHeading>
          <p className="max-w-sm text-[16px] text-[var(--ink)]/68">Payees vouch for their wallets. The assistant does the paperwork. You keep the pen.</p>
        </div>
        <div className="mt-12">
          <HowPanels />
        </div>
      </section>

      {/* Try to trick it */}
      <section id="trick" className="scroll-mt-6 overflow-hidden bg-[var(--forest-900)] text-[var(--mist)]" aria-labelledby="trick-h">
        <div className="mx-auto max-w-[1200px] px-5 py-24 md:px-10 md:py-32">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-end">
            <RevealHeading id="trick-h" className="text-[clamp(34px,4vw,48px)] leading-[1.05] tracking-[-0.02em]">
              Try to trick it. <em className="font-light text-[var(--gold)]">The contract won&apos;t budge.</em>
            </RevealHeading>
            <p className="max-w-md text-[16px] text-[var(--mist)]/70 lg:justify-self-end">
              Eight rules live on-chain: confirmed payees, per-person, per-run and monthly caps, expiry, pause, no double pay and a signature from each worker. Even a fooled assistant can&apos;t get past them.
            </p>
          </div>
          <div className="mt-12">
            <TrickDemo />
          </div>
        </div>
      </section>

      <PayslipFan />

      {/* One payday */}
      <section className="mx-auto max-w-[1200px] px-5 py-24 md:px-10 md:py-32" aria-labelledby="day">
        <RevealHeading id="day" className="text-[clamp(34px,4vw,48px)] leading-[1.05] tracking-[-0.02em]">One payday, start to finish</RevealHeading>
        <PaydayTimeline />
      </section>

      {/* Proof */}
      <section className="border-t border-[var(--ink)]/10" aria-labelledby="proof">
        <div className="mx-auto max-w-[1200px] px-5 py-20 md:px-10">
          <h2 id="proof" className="sr-only">Running on Aevum testnet</h2>
          <ChainPulse />
        </div>
      </section>

      {/* Footer */}
      <footer className="relative overflow-hidden bg-[var(--forest-950)] text-[var(--mist)]">
        <div className="mx-auto max-w-[1200px] px-5 pt-16 md:px-10">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <p className="max-w-sm text-[15px] text-[var(--mist)]/65">
              Open source under MIT. Built for the Aevum Builder Challenge. Test funds only, never real money.
            </p>
            <nav className="flex gap-6 text-[14px] text-[var(--mist)]/75" aria-label="Footer">
              <a href={GITHUB} target="_blank" rel="noreferrer" className="hover:text-[var(--mist)]">GitHub</a>
              <a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-[var(--mist)]">Explorer</a>
              <a href={DORAHACKS} target="_blank" rel="noreferrer" className="hover:text-[var(--mist)]">DoraHacks</a>
            </nav>
          </div>
          <p
            aria-hidden
            className="mt-10 select-none font-serif text-[clamp(72px,17vw,232px)] leading-[0.8] tracking-[-0.04em] text-transparent [-webkit-text-stroke:1px_color-mix(in_srgb,var(--gold)_55%,transparent)]"
          >
            PayWarden
          </p>
        </div>
      </footer>
    </div>
  );
}
