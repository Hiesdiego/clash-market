"use client";

import { createPublicClient, erc20Abi } from "viem";
import type { Address } from "viem";
import { getPublicEnv } from "@/lib/env";
import { COLLATERAL, somniaMainnet, somniaTestnet } from "@/lib/chains/somnia";
import { createRpcFallbackTransport } from "@/lib/chains/rpc";

/**
 * Balance reads deliberately use a plain HTTP JSON-RPC client, rather than the
 * markets SDK. The SDK's client opens its configured market websocket before
 * exposing reads; a bad/stale market stream must never make a user's wallet
 * look empty.
 */
let publicClient: ReturnType<typeof createPublicClient> | null = null;

export function activeChain() {
  return getPublicEnv().NEXT_PUBLIC_SOMNIA_NETWORK === "mainnet" ? somniaMainnet : somniaTestnet;
}

export function activeCollateral() {
  return getPublicEnv().NEXT_PUBLIC_SOMNIA_NETWORK === "mainnet" ? COLLATERAL.mainnet : COLLATERAL.testnet;
}

function getPublicClient() {
  if (publicClient) return publicClient;
  const env = getPublicEnv();
  const chain = activeChain();
  publicClient = createPublicClient({
    chain,
    transport: createRpcFallbackTransport([
      chain.rpcUrls.default.http[0],
      env.NEXT_PUBLIC_VALIDATION_CLOUD_RPC,
    ]),
  });
  return publicClient;
}

export async function getWalletBalances(address: Address) {
  const collateral = activeCollateral();
  const client = getPublicClient();
  const [native, token] = await Promise.all([
    client.getBalance({ address }),
    client.readContract({
      address: collateral.address as Address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    }),
  ]);

  return { native, token, collateral };
}
