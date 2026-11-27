import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Overview",
  description: "Your PayWarden vault: balance, the assistant's allowance and your controls.",
  alternates: { canonical: "/app" },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
