"use client";

import { SomniaMarkets } from "@somnia-chain/markets-sdk";
import type { WalletClient } from "viem";
import { getPublicEnv } from "@/lib/env";
import { somniaMainnet, somniaTestnet, DREAMDEX_CORE_CONTRACTS } from "@/lib/chains/somnia";
import { createReadFailover, uniqueRpcUrls } from "@/lib/chains/rpc";

/**
 * Client-side exchange instance for the Squad Builder. Confirmed
 * pattern straight from the SDK's own `setSigner` doc comment:
 * "Browser apps construct the exchange at boot for public reads, then
 * call this when the user's wallet connects."
 *
 * Constructed with no signer initially — `SomniaMarketsConfig`'s
 * privateKey/account/walletClient are all optional, confirmed from the
 * SDK's shipped types (installed and inspected directly rather than
 * guessed). Live odds display and board browsing work before any
 * wallet is connected; `bindSigner()` is called once Privy's wallet is
 * ready, right before a real order needs to be placed.
 */
let exchange: SomniaMarkets | null = null;

export function getDreamDexBrowserClient(): SomniaMarkets {
  if (exchange) return exchange;

  const env = getPublicEnv();
  const chain = env.NEXT_PUBLIC_SOMNIA_NETWORK === "mainnet" ? somniaMainnet : somniaTestnet;

  const wsRpcUrls = uniqueRpcUrls([
    env.NEXT_PUBLIC_SOMNIA_MARKETS_WS_RPC_URL,
    env.NEXT_PUBLIC_VALIDATION_CLOUD_WSS,
  ]);
  const clients = wsRpcUrls.map((wsRpcUrl) => new SomniaMarkets({
    indexerUrl: env.NEXT_PUBLIC_SOMNIA_MARKETS_INDEXER_URL,
    chain,
    wsRpcUrl,
    addresses: DREAMDEX_CORE_CONTRACTS,
    // No signer yet — public reads only until bindSigner() is called.
  }));
  exchange = createReadFailover(clients);

  return exchange;
}

/**
 * Binds the connected wallet's viem WalletClient as the exchange's
 * signer — confirmed via SomniaMarketsConfig's type
 * (`Pick<TraderConfig, "privateKey" | "account" | "walletClient">`),
 * so a browser wallet client is a first-class alternative to a raw
 * private key, not something bolted on. Call again with `{}` on
 * disconnect to return to unauthenticated reads (per the SDK's own
 * doc comment on `setSigner`).
 */
export function bindSigner(walletClient: WalletClient) {
  getDreamDexBrowserClient().setSigner({ walletClient });
}

export function unbindSigner() {
  getDreamDexBrowserClient().setSigner({});
}
