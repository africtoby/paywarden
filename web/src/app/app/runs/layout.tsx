import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Runs | PayWarden" },
  description: "Review pay runs your assistant drafted, see the eight on-chain checks, then approve, sign and pay.",
  alternates: { canonical: "/app/runs" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
