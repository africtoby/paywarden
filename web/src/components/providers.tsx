"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { wagmiConfig } from "@/lib/wagmi";

const accent = { accentColor: "#0E3B2B", accentColorForeground: "#E6ECE4", borderRadius: "large" as const };
const accentDark = { accentColor: "#CDB97E", accentColorForeground: "#072019", borderRadius: "large" as const };

function Inner({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <RainbowKitProvider theme={dark ? darkTheme(accentDark) : lightTheme(accent)} modalSize="compact">
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
          <Inner>{children}</Inner>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
