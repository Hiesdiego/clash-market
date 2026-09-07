import "server-only";

import { SomniaMarkets } from "@somnia-chain/markets-sdk";

import { somniaMainnet, somniaTestnet, DREAMDEX_CORE_CONTRACTS } from "@/lib/chains/somnia";
import { getEnv } from "@/lib/env";
import { createReadFailover, uniqueRpcUrls } from "@/lib/chains/rpc";

// Server-side, read-only market client. The sync worker and board route do
// not need a signer; they only fetch market metadata and order books.
let exchange: SomniaMarkets | null = null;

export function getDreamDexReadClient(): SomniaMarkets {
  if (exchange) return exchange;

  const env = getEnv();
  const chain = env.NEXT_PUBLIC_SOMNIA_NETWORK === "mainnet" ? somniaMainnet : somniaTestnet;

  const wsRpcUrls = uniqueRpcUrls([env.SOMNIA_MARKETS_WS_RPC_URL, env.VALIDATION_CLOUD_WSS]);
  const clients = wsRpcUrls.map((wsRpcUrl) => new SomniaMarkets({
    indexerUrl: env.SOMNIA_MARKETS_INDEXER_URL,
    chain,
    wsRpcUrl,
    addresses: DREAMDEX_CORE_CONTRACTS,
  }));
  exchange = createReadFailover(clients);

  return exchange;
}
