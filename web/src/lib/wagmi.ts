import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { aevum } from "./chain";

export const wagmiConfig = getDefaultConfig({
  appName: "PayWarden",
  // A WalletConnect id is optional: browser wallets work without one.
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID ?? "paywarden-dev",
  chains: [aevum],
  transports: { [aevum.id]: http(aevum.rpcUrls.default.http[0]) },
  ssr: true,
});
