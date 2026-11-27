import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Activity | PayWarden" },
  description: "Every action in your PayWarden vault, read straight from on-chain events with explorer links.",
  alternates: { canonical: "/app/activity" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
