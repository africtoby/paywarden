"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { useEffect, useState, useSyncExternalStore } from "react";
import { WagmiProvider, useAccount, useConnect } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { MotionConfig } from "framer-motion";
import { devMock, wagmiConfig } from "@/lib/wagmi";

const accent = { accentColor: "#0E3B2B", accentColorForeground: "#E6ECE4", borderRadius: "large" as const };
const accentDark = { accentColor: "#CDB97E", accentColorForeground: "#072019", borderRadius: "large" as const };

const noopSubscribe = () => () => {};

/** Dev only (NEXT_PUBLIC_DEV_MOCK=1): connects the test account so pages can be checked without a wallet. */
function DevAutoConnect() {
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();
  useEffect(() => {
    if (!isConnected && connectors[0]) connect({ connector: connectors[0] });
  }, [isConnected, connectors, connect]);
  return null;
}

function Inner({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  // false on the server and during hydration, true afterwards: keeps RainbowKit's
  // injected theme CSS identical to the server HTML, then switches to the real theme.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const dark = hydrated && resolvedTheme === "dark";
  return (
    <RainbowKitProvider theme={dark ? darkTheme(accentDark) : lightTheme(accent)} modalSize="compact">
      {devMock && <DevAutoConnect />}
      {children}
      <Toaster position="bottom-right" theme={dark ? "dark" : "light"} />
    </RainbowKitProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000 } } }));
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={client}>
          <MotionConfig reducedMotion="user">
            <Inner>{children}</Inner>
          </MotionConfig>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
