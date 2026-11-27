import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Payees | PayWarden" },
  description: "Invite payees by name and wallet. Each one confirms with their own wallet before they can be paid.",
  alternates: { canonical: "/app/payees" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
