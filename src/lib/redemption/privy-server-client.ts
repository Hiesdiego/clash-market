import "server-only";
import { PrivyClient } from "@privy-io/node";
import { getEnv } from "@/lib/env";
import { DREAMDEX_CORE_CONTRACTS } from "@/lib/chains/somnia";

let client: PrivyClient | null = null;

function getPrivyServerClient(): PrivyClient {
  if (!client) {
    const env = getEnv();
    client = new PrivyClient({ appId: env.NEXT_PUBLIC_PRIVY_APP_ID, appSecret: env.PRIVY_APP_SECRET });
  }
  return client;
}


export async function redeemForUser(params: {
  walletId: string;
  onchainMarketId: `0x${string}`;
  outcomeIndex: 0 | 1;
  amountRaw: bigint;
}): Promise<{ transactionHash: string }> {
  const env = getEnv();
  if (!env.PRIVY_AUTHORIZATION_PRIVATE_KEY) {
    throw new Error("PRIVY_AUTHORIZATION_PRIVATE_KEY not configured — see docs/PHASE-2-AUTH.md setup steps");
  }

  const { to, data } = buildRedeemCalldata(params);
  const privy = getPrivyServerClient();

  const result = await privy.wallets().ethereum().sendTransaction(params.walletId, {
    chain_id: 50312, // Shannon testnet — swap for env-aware chain id before mainnet
    transaction: { to, data, value: "0x0" },
    authorization_context: { authorization_private_keys: [env.PRIVY_AUTHORIZATION_PRIVATE_KEY] },
  } as unknown as Parameters<ReturnType<ReturnType<PrivyClient["wallets"]>["ethereum"]>["sendTransaction"]>[1]);

  return { transactionHash: (result as { hash: string }).hash };
}


function buildRedeemCalldata(_params: {
  onchainMarketId: `0x${string}`;
  outcomeIndex: 0 | 1;
  amountRaw: bigint;
}): { to: `0x${string}`; data: `0x${string}` } {
  throw new Error(
    `Redeem calldata not yet implemented — see the doc comment above buildRedeemCalldata() in redemption/privy-server-client.ts. BinarySettlement address: ${DREAMDEX_CORE_CONTRACTS.binarySettlement}`
  );
}
