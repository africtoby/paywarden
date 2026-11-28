import type { Metadata } from "next";

// Invite links are private: keep this page out of search results.
export const metadata: Metadata = {
  title: "Sign your hours",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
