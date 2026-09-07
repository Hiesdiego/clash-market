import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEnv, isMainnet } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Server-side (RSC / route handler) Supabase client. Same testnet/mainnet
 * split as the browser client — see client.ts.
 */
export async function createSupabaseServerClient() {
  const env = getEnv();
  const mainnet = isMainnet();
  const cookieStore = await cookies();

  const url = mainnet ? env.NEXT_PUBLIC_SUPABASE_URL_MAINNET : env.NEXT_PUBLIC_SUPABASE_URL_TESTNET;
  const anonKey = mainnet
    ? env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MAINNET
    : env.NEXT_PUBLIC_SUPABASE_ANON_KEY_TESTNET;

  if (!url || !anonKey) {
    throw new Error(
      `Missing Supabase ${mainnet ? "mainnet" : "testnet"} env vars — check .env.local against .env.example`
    );
  }

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component with no request context — safe
          // to ignore as long as middleware also refreshes the session.
        }
      },
    },
  });
}
