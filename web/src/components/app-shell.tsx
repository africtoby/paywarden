"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
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
              className={cn(
                "flex items-center gap-3 rounded-full px-4 py-2.5 text-[14px] text-foreground/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2",
                active(href) && "bg-accent text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <p className="meta mt-auto text-muted-foreground">Aevum testnet</p>
      </aside>

      <div className="flex min-w-0 flex-col pb-20 md:pb-0">
        <header className="flex items-center justify-between gap-3 px-5 py-4 md:px-10">
          <Link href="/" className="font-serif text-[18px] md:hidden">
            PayWarden
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <ConnectButton accountStatus={{ smallScreen: "avatar", largeScreen: "address" }} chainStatus="icon" showBalance={false} />
          </div>
        </header>
        <main className="w-full max-w-[1120px] flex-1 px-5 pb-10 md:px-10">{children}</main>
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
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px] text-foreground/60 focus-visible:outline-2 focus-visible:-outline-offset-2",
              active(href) && "text-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
