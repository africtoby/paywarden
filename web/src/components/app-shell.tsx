"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Halftone } from "@/components/landing/halftone";
import { WalletButton } from "@/components/wallet-button";
import { useTheme } from "next-themes";
import { Activity, Bot, FileText, LayoutDashboard, Moon, Sun, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/app", label: "Overview", icon: LayoutDashboard },
  { href: "/app/payees", label: "Payees", icon: Users },
  { href: "/app/assistant", label: "Assistant", icon: Bot },
  { href: "/app/runs", label: "Runs", icon: FileText },
  { href: "/app/activity", label: "Activity", icon: Activity },
];

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      aria-label="Toggle light and dark theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="inline-flex size-10 items-center justify-center rounded-full border border-border text-foreground/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <Sun className="size-4 hidden dark:block" aria-hidden />
      <Moon className="size-4 dark:hidden" aria-hidden />
    </button>
  );
}

/** The one shared pill behind the active nav item. It slides to the next item (layoutId). */
function Pill({ id, className }: { id: string; className: string }) {
  return (
    <motion.span
      layoutId={id}
      aria-hidden
      className={cn("absolute inset-0 border border-gold/50 bg-sidebar-primary", className)}
      transition={{ type: "spring", stiffness: 520, damping: 40 }}
    />
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const active = (href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));

  return (
    <div className="min-h-screen md:grid md:grid-cols-[232px_1fr]">
      <aside className="hidden md:flex md:flex-col md:gap-8 md:border-r md:border-border md:bg-sidebar md:px-5 md:py-7 md:sticky md:top-0 md:h-screen">
        <Link href="/" className="font-serif text-[22px] tracking-[-0.015em]">
          PayWarden
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              className="relative flex items-center gap-3 rounded-full border border-transparent px-4 py-2.5 text-[14px] text-foreground/75 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 aria-[current=page]:text-sidebar-primary-foreground aria-[current=page]:hover:text-sidebar-primary-foreground"
            >
              {active(href) && <Pill id="nav-pill-desktop" className="rounded-full" />}
              <Icon className="relative size-4" aria-hidden />
              <span className="relative">{label}</span>
            </Link>
          ))}
        </nav>
        <p className="meta mt-auto text-muted-foreground">Aevum testnet</p>
      </aside>

      <div className="flex min-w-0 flex-col pb-20 md:pb-0">
        <header className="relative flex items-center justify-between gap-3 overflow-hidden px-5 py-4 md:px-10">
          <Halftone tone="--halftone" parallax={false} className="absolute -right-16 top-1/2 size-[560px] -translate-y-1/2 opacity-[0.04]" />
          <Link href="/" className="relative font-serif text-[18px] md:hidden">
            PayWarden
          </Link>
          <div className="relative ml-auto flex items-center gap-3">
            <ThemeToggle />
            <WalletButton showAccount size="default" />
          </div>
        </header>
        <motion.main
          key={path}
          className="w-full max-w-[1120px] flex-1 px-5 pb-10 md:px-10"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {children}
        </motion.main>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-sidebar md:hidden"
      >
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={active(href) ? "page" : undefined}
            className="relative m-1 flex flex-col items-center gap-1 rounded-2xl border border-transparent py-1.5 text-[11px] text-foreground/70 focus-visible:outline-2 focus-visible:-outline-offset-2 aria-[current=page]:text-sidebar-primary-foreground"
          >
            {active(href) && <Pill id="nav-pill-mobile" className="rounded-2xl" />}
            <Icon className="relative size-5" aria-hidden />
            <span className="relative">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
