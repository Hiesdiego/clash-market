import "server-only";
import { PrivyClient } from "@privy-io/node";
import { getEnv } from "@/lib/env";

let client: PrivyClient | null = null;

function getPrivyServerClient(): PrivyClient {
  if (!client) {
    const env = getEnv();
    client = new PrivyClient({
      appId: env.NEXT_PUBLIC_PRIVY_APP_ID,
      appSecret: env.PRIVY_APP_SECRET,
    });
  }
  return client;
}

/**
 * After verifyPrivyAccessToken() confirms a token is a genuine, current
 * Privy session for `privyUserId`, this fetches that user's actual
 * record from Privy's server API — including their linked wallet
 * address — rather than trusting a wallet address the client sends
 * alongside the token. A client that controls its own request body can
 * claim any address; only Privy's own server API can say which address
 * is really linked to which verified session.
 *
 * SDK shape, confirmed against the installed @privy-io/node@0.30 types:
 *   - `users().get()` does NOT fetch a user by id — it *parses/verifies an
 *     identity token* (`get({ id_token })`). Calling it with a user-id
 *     string leaves `id_token` undefined, so the SDK tries to verify
 *     `undefined` and throws the generic jose failure "Failed to verify
 *     authentication token". The by-id REST getter is `_get(id)` →
 *     `GET /v1/users/{id}`.
 *   - The REST `User` payload is snake_case: `linked_accounts[]` with
 *     `{ type, chain_type, address, id, connector_type }` — not the
 *     camelCase `linkedAccounts`/`chainType` the @privy-io/react-auth
 *     client object uses.
 */
export async function getVerifiedPrivyUser(privyUserId: string) {
  const privy = getPrivyServerClient();
  const user = await privy.users()._get(privyUserId);

  // The linked_accounts union has ~25 members (email, oauth, passkey, …);
  // only wallet members carry chain_type/address, so narrow defensively.
  const evmWallets = (
    user.linked_accounts as Array<{
      type: string;
      chain_type?: string;
      connector_type?: string;
      address?: string;
      id?: string | null;
    }>
  ).filter((a) => a.type === "wallet" && a.chain_type === "ethereum" && !!a.address);

  // Prefer an embedded wallet: it carries the `id` that Privy's server
  // wallet API needs to sign for the user (Phase 5 redemption automation).
  // External / wallet-first logins have no embedded wallet, so fall back to
  // whichever EVM wallet is linked — Privy can't server-sign for those, so
  // privy_wallet_id is legitimately null there.
  const walletAccount =
    evmWallets.find((a) => a.connector_type === "embedded") ?? evmWallets[0];

  if (!walletAccount?.address) {
    throw new Error(`Privy user ${privyUserId} has no linked EVM wallet`);
  }

  return {
    privyUserId,
    walletAddress: walletAccount.address,
    privyWalletId: walletAccount.id ?? undefined,
  };
}
