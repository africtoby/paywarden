import type { Metadata } from "next";
import { Figtree, Fraunces, Geist_Mono, Mrs_Saint_Delafield } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"], weight: ["400", "500"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], weight: ["300", "400"], style: ["normal", "italic"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], weight: ["400", "500"] });
const script = Mrs_Saint_Delafield({ variable: "--font-script", subsets: ["latin"], weight: "400" });

const description =
  "An AI assistant drafts your payroll. A contract on QDay Aevum checks it against your limits. Nothing moves until you sign.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.paywarden.me"),
  title: "PayWarden: payroll your AI prepares. Only you can sign.",
  description,
  applicationName: "PayWarden",
  openGraph: {
    type: "website",
    siteName: "PayWarden",
    url: "/",
    title: "PayWarden: payroll your AI prepares. Only you can sign.",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "PayWarden: payroll your AI prepares. Only you can sign.",
    description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${figtree.variable} ${fraunces.variable} ${geistMono.variable} ${script.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
