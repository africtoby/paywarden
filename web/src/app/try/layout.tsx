import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Try it without a wallet | PayWarden" },
  description:
    "Run a payday in five steps with no wallet: set limits, give the AI assistant a timesheet, try to trick it, watch the contract's checks refuse the bad draft, then sign.",
  alternates: { canonical: "/try" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
