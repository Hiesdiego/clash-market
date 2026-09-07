import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the ops/admin surface (Phase 0 note in the build plan) out of the
  // public bundle — it lives under src/app/(admin) as its own route group
  // and is gated in middleware once auth roles exist (Phase 2+).
  experimental: {
    // markets-sdk is TS-only and talks to Somnia directly; no special
    // bundler config needed yet, this is a placeholder for when the
    // settlement listener background worker gets split out in Phase 5+.
  },
};

export default nextConfig;
