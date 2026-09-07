import { z } from "zod";



const NetworkSchema = z.enum(["testnet", "mainnet"]);

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SOMNIA_NETWORK: NetworkSchema.default("testnet"),
  NEXT_PUBLIC_PRIVY_APP_ID: z.string().min(1, "Privy app id is required"),
  NEXT_PUBLIC_PRIVY_SIGNER_ID: z.string().min(1).or(z.literal("")),
  NEXT_PUBLIC_PRIVY_TRADE_POLICY_ID: z.string().min(1).or(z.literal("")),
  NEXT_PUBLIC_PRIVY_REDEEM_POLICY_ID: z.string().min(1).or(z.literal("")),
  NEXT_PUBLIC_SOMNIA_MARKETS_INDEXER_URL: z.string().url().or(z.literal("")),
  NEXT_PUBLIC_SOMNIA_MARKETS_WS_RPC_URL: z.string().min(1).or(z.literal("")),
  NEXT_PUBLIC_TESTNET_FAUCET_BOT_URL: z.string().url().or(z.literal("")).default(""),

  NEXT_PUBLIC_VALIDATION_CLOUD_RPC: z.string().url().or(z.literal("")).default(""),
  NEXT_PUBLIC_VALIDATION_CLOUD_WSS: z.string().url().or(z.literal("")).default(""),
  NEXT_PUBLIC_SUPABASE_URL_TESTNET: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY_TESTNET: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL_MAINNET: z.string().url().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY_MAINNET: z.string().min(1).or(z.literal("")),
});

const envSchema = z.object({
  NEXT_PUBLIC_SOMNIA_NETWORK: NetworkSchema.default("testnet"),

  NEXT_PUBLIC_PRIVY_APP_ID: z.string().min(1, "Privy app id is required"),
 
  PRIVY_APP_SECRET: z.string().min(1, "Privy app secret is required"),

  PRIVY_AUTHORIZATION_KEY_ID: z.string().min(1).optional(),
  PRIVY_AUTHORIZATION_PRIVATE_KEY: z.string().min(1).optional(),


  NEXT_PUBLIC_PRIVY_SIGNER_ID: z.string().min(1).or(z.literal("")),
  NEXT_PUBLIC_PRIVY_TRADE_POLICY_ID: z.string().min(1).or(z.literal("")),
  NEXT_PUBLIC_PRIVY_REDEEM_POLICY_ID: z.string().min(1).or(z.literal("")),

  SOMNIA_MARKETS_INDEXER_URL: z.string().url().or(z.literal("")),
  SOMNIA_MARKETS_WS_RPC_URL: z.string().min(1).or(z.literal("")),
  NEXT_PUBLIC_SOMNIA_MARKETS_INDEXER_URL: z.string().url().or(z.literal("")),
  NEXT_PUBLIC_SOMNIA_MARKETS_WS_RPC_URL: z.string().min(1).or(z.literal("")),
  // Validation Cloud endpoints are server-only by default. They are kept
  // optional so deployments without the fallback remain valid.
  VALIDATION_CLOUD_RPC: z.string().url().or(z.literal("")).default(""),
  VALIDATION_CLOUD_WSS: z.string().url().or(z.literal("")).default(""),
  // A throwaway keypair with zero funds — this job only ever reads
  // (loadMarkets, getMarketOnchain, listBinaryMarkets, fetchOrderBook),
  // never signs a transaction. Kept separate from any real trading key
  // on principle: a read-only job should hold a key that can't lose
  // anything even if it leaked.
  SYNC_JOB_PRIVATE_KEY: z.string().min(1).or(z.literal("")),
  // Shared secret checked on the sync trigger routes — these mutate the
  // `markets` table and shouldn't be publicly callable. Generate with
  // `openssl rand -hex 32`.
  SYNC_JOB_SECRET: z.string().min(1).or(z.literal("")),
  // Same idea for the ops/curation-toggle routes, until a real

  ADMIN_API_SECRET: z.string().min(1).or(z.literal("")),
 
  FAUCET_PRIVATE_KEY: z.string().min(1).or(z.literal("")),
  FAUCET_STT_AMOUNT: z.string().min(1).default("1"),
  FAUCET_TUSDC_AMOUNT: z.string().min(1).default("10"),

  // Testnet Supabase project (Shannon, chain 50312)
  NEXT_PUBLIC_SUPABASE_URL_TESTNET: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY_TESTNET: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY_TESTNET: z.string().min(1).optional(), // server-only

  // Mainnet Supabase project (chain 5031) 

  NEXT_PUBLIC_SUPABASE_URL_MAINNET: z.string().url().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY_MAINNET: z.string().min(1).or(z.literal("")),
  SUPABASE_SERVICE_ROLE_KEY_MAINNET: z.string().min(1).or(z.literal("")),
});

type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;
let cachedPublic: PublicEnv | null = null;

type PublicEnv = z.infer<typeof publicEnvSchema>;

export function getPublicEnv(): PublicEnv {
  if (cachedPublic) return cachedPublic;

  // Read public keys directly so Next.js can inline them in client bundles.
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SOMNIA_NETWORK: process.env.NEXT_PUBLIC_SOMNIA_NETWORK,
    NEXT_PUBLIC_PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
    NEXT_PUBLIC_PRIVY_SIGNER_ID: process.env.NEXT_PUBLIC_PRIVY_SIGNER_ID,
    NEXT_PUBLIC_PRIVY_TRADE_POLICY_ID: process.env.NEXT_PUBLIC_PRIVY_TRADE_POLICY_ID,
    NEXT_PUBLIC_PRIVY_REDEEM_POLICY_ID: process.env.NEXT_PUBLIC_PRIVY_REDEEM_POLICY_ID,
    NEXT_PUBLIC_SOMNIA_MARKETS_INDEXER_URL: process.env.NEXT_PUBLIC_SOMNIA_MARKETS_INDEXER_URL,
    NEXT_PUBLIC_SOMNIA_MARKETS_WS_RPC_URL: process.env.NEXT_PUBLIC_SOMNIA_MARKETS_WS_RPC_URL,
    NEXT_PUBLIC_TESTNET_FAUCET_BOT_URL: process.env.NEXT_PUBLIC_TESTNET_FAUCET_BOT_URL,
    NEXT_PUBLIC_VALIDATION_CLOUD_RPC: process.env.NEXT_PUBLIC_VALIDATION_CLOUD_RPC,
    NEXT_PUBLIC_VALIDATION_CLOUD_WSS: process.env.NEXT_PUBLIC_VALIDATION_CLOUD_WSS,
    NEXT_PUBLIC_SUPABASE_URL_TESTNET: process.env.NEXT_PUBLIC_SUPABASE_URL_TESTNET,
    NEXT_PUBLIC_SUPABASE_ANON_KEY_TESTNET: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_TESTNET,
    NEXT_PUBLIC_SUPABASE_URL_MAINNET: process.env.NEXT_PUBLIC_SUPABASE_URL_MAINNET,
    NEXT_PUBLIC_SUPABASE_ANON_KEY_MAINNET: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_MAINNET,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid public environment configuration:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`
    );
  }
  cachedPublic = parsed.data;
  return cachedPublic;
}

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`
    );
  }
  cached = parsed.data;
  return cached;
}

export function isMainnet(): boolean {
  return getEnv().NEXT_PUBLIC_SOMNIA_NETWORK === "mainnet";
}
