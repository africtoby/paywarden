"use client";

import { WalletButton } from "@/components/wallet-button";

/** What every /app page shows until a wallet is connected. */
export function ConnectPrompt({ title, copy }: { title: React.ReactNode; copy: string }) {
  return (
    <div className="max-w-xl pt-10">
      <h1 className="page-title">{title}</h1>
      <p className="mt-3 text-[16px] text-muted-foreground">{copy}</p>
      <div className="mt-6">
        <WalletButton />
      </div>
    </div>
  );
}
