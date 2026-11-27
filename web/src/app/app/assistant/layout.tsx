import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Assistant permissions | PayWarden" },
  description: "Set what your AI payroll assistant may draft: per-run, per-person and period caps, an expiry and an instant off switch.",
  alternates: { canonical: "/app/assistant" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
