"use client";

import type { ConnectedWallet } from "@privy-io/react-auth";
import { createWalletClient, custom, type Address, type WalletClient } from "viem";
import { getPublicEnv } from "@/lib/env";
import { somniaMainnet, somniaTestnet } from "@/lib/chains/somnia";

/**
 * Creates the ordinary viem client used by the original Privy transaction
 * flow. The connected wallet remains the signer and the user's address stays
 * the transaction sender, which is what DreamDEX's deployed contracts expect.
 */
export async function createPrivyWalletClient(privyWallet: ConnectedWallet): Promise<{
  address: Address;
  walletClient: WalletClient;
}> {
  const env = getPublicEnv();
  const chain = env.NEXT_PUBLIC_SOMNIA_NETWORK === "mainnet" ? somniaMainnet : somniaTestnet;
  await privyWallet.switchChain(chain.id);

  const provider = await privyWallet.getEthereumProvider();
  const address = privyWallet.address as Address;
  const walletClient = createWalletClient({
    account: address,
    chain,
    transport: custom(provider),
  });

  return { address, walletClient };
}
