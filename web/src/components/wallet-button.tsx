"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Button } from "@/components/ui/button";

type Props = {
  /** Text on the button before a wallet is connected. */
  label?: string;
  /** Show the connected account and network (the app header). Off for one-off prompts. */
  showAccount?: boolean;
  size?: "default" | "lg";
};

/** RainbowKit's connect flow, drawn with our own pill buttons so it matches DESIGN.md. */
export function WalletButton({ label = "Connect wallet", showAccount = false, size = "lg" }: Props) {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openConnectModal, openAccountModal, openChainModal }) => {
        // Keep the layout stable while RainbowKit restores a saved connection.
        if (!mounted) {
          return <Button size={size} className="invisible px-5" aria-hidden tabIndex={-1}>{label}</Button>;
        }
        if (!account || !chain) {
          return (
            <Button size={size} className="px-5" onClick={openConnectModal}>
              {label}
            </Button>
          );
        }
        if (chain.unsupported) {
          return (
            <Button size={size} variant="destructive" className="px-5" onClick={openChainModal}>
              Switch to Aevum testnet
            </Button>
          );
        }
        if (!showAccount) return null;
        return (
          <Button size={size} variant="outline" className="px-4 font-mono text-[13px] tnum" onClick={openAccountModal} aria-label={`Wallet ${account.address}`}>
            <span className="size-2 rounded-full bg-[#1f6b47] dark:bg-[#7fbf9a]" aria-hidden />
            {account.displayName}
          </Button>
        );
      }}
    </ConnectButton.Custom>
  );
}
