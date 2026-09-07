import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getEnv, isMainnet } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";


export function createSupabaseAdminClient() {
  const env = getEnv();
  const mainnet = isMainnet();

  const url = mainnet ? env.NEXT_PUBLIC_SUPABASE_URL_MAINNET : env.NEXT_PUBLIC_SUPABASE_URL_TESTNET;
  const serviceKey = mainnet
    ? env.SUPABASE_SERVICE_ROLE_KEY_MAINNET
    : env.SUPABASE_SERVICE_ROLE_KEY_TESTNET;

  if (!url || !serviceKey) {
    throw new Error(
      `Missing Supabase ${mainnet ? "mainnet" : "testnet"} service role env vars — check .env.local`
    );
  }

  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
