import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { createConfig, http } from "wagmi";
import { mock } from "wagmi/connectors";
import type { Address } from "viem";
import { aevum } from "./chain";

// Dev only: set NEXT_PUBLIC_DEV_MOCK=1 (with NEXT_PUBLIC_DEV_RPC and NEXT_PUBLIC_DEV_ACCOUNT) to run against a
// local fork and a pre-connected test account, so every page can be checked without a browser wallet.
export const devMock = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEV_MOCK === "1";

const devRpc = process.env.NEXT_PUBLIC_DEV_RPC ?? "http://127.0.0.1:8545";
// The mock connector sends wallet calls to the chain's own RPC url, so point the chain at the fork.
const devChain = { ...aevum, rpcUrls: { default: { http: [devRpc] } } } as typeof aevum;

export const wagmiConfig = devMock
  ? createConfig({
      chains: [devChain],
      connectors: [mock({ accounts: [process.env.NEXT_PUBLIC_DEV_ACCOUNT as Address], features: { defaultConnected: true } })],
      transports: { [aevum.id]: http(devRpc) },
      ssr: true,
    })
  : getDefaultConfig({
      appName: "PayWarden",
      // A WalletConnect id is optional: browser wallets work without one.
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID ?? "paywarden-dev",
      chains: [aevum],
      transports: { [aevum.id]: http(aevum.rpcUrls.default.http[0]) },
      ssr: true,
    });
