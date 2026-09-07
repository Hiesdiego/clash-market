"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";


export function createSupabaseBrowserClient() {
  const env = getPublicEnv();
  const mainnet = env.NEXT_PUBLIC_SOMNIA_NETWORK === "mainnet";

  const url = mainnet ? env.NEXT_PUBLIC_SUPABASE_URL_MAINNET : env.NEXT_PUBLIC_SUPABASE_URL_TESTNET;
  const anonKey = mainnet
    ? env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MAINNET
    : env.NEXT_PUBLIC_SUPABASE_ANON_KEY_TESTNET;

  if (!url || !anonKey) {
    throw new Error(
      `Missing Supabase ${mainnet ? "mainnet" : "testnet"} env vars — check .env.local against .env.example`
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}
