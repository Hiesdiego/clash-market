"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { getPublicEnv } from "@/lib/env";
import { somniaMainnet, somniaTestnet } from "@/lib/chains/somnia";


export function ClashPrivyProvider({ children }: { children: React.ReactNode }) {
  const env = getPublicEnv();
  const activeChain = env.NEXT_PUBLIC_SOMNIA_NETWORK === "mainnet" ? somniaMainnet : somniaTestnet;

  return (
    <PrivyProvider
      appId={env.NEXT_PUBLIC_PRIVY_APP_ID}
      config={{
        defaultChain: activeChain,
        supportedChains: [somniaTestnet, somniaMainnet],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },

          showWalletUIs: false,
        },
        appearance: {
          theme: "#07110d",
          accentColor: "#ffd23f",
          logo: "/assets/logo/cm-logo.png",
          landingHeader: "Pick a side. Play the market.",
          loginMessage: "Sign in to CLASH MARKET with email, Google, or your favorite wallet.",
          walletChainType: "ethereum-only",
          walletList: ["detected_ethereum_wallets", "metamask", "coinbase_wallet", "rainbow", "wallet_connect"],
        },
        loginMethodsAndOrder: {
          primary: ["email", "google", "detected_ethereum_wallets", "metamask", "coinbase_wallet", "rainbow", "wallet_connect"],
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
