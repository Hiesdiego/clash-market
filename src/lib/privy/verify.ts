import "server-only";

import { PrivyClient } from "@privy-io/node";

import { getEnv } from "@/lib/env";

// Use Privy's server SDK for this verification rather than maintaining a
// custom JWKS endpoint. The SDK owns the correct JWKS URL, ES256 algorithm,
// issuer, and audience validation for the installed Privy version.
let client: PrivyClient | null = null;

export async function verifyPrivyAccessToken(token: string): Promise<{ privyUserId: string }> {
  const env = getEnv();

  if (!client) {
    client = new PrivyClient({
      appId: env.NEXT_PUBLIC_PRIVY_APP_ID,
      appSecret: env.PRIVY_APP_SECRET,
    });
  }

  const verified = await client.utils().auth().verifyAccessToken(token);
  return { privyUserId: verified.user_id };
}
