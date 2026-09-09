import "server-only";

import { getDreamDexReadClient } from "@/lib/dreamdex/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SyncScope } from "@/lib/dreamdex/sync";

/**
 * Authoritative on-chain settlement reconciliation — the backstop for
 * gotcha #1 (the DreamDEX indexer lags). `syncResolvedMarkets` learns that a
 * market resolved only from the indexer's "Finalized" feed; when that feed
 * lags or misses a market, the `markets` row never reaches a terminal state,
 * so `settlePicksForLeague` skips its picks (they require a resolved/voided
 * market with a concrete outcome) and the position shows "settling…" forever
 * with `resolution_outcome` NULL — even though the market IS settled on-chain.
 *
 * This pass never trusts the indexer. It finds rows that SHOULD have settled
 * (past expiry, still non-terminal in our DB) and reads each one straight from
 * chain via `getMarketOnchain` — which the SDK documents as working "before
 * indexing" and which already backs solo-trade settlement. The `isResolved` /
 * `isVoided` / `winningOutcome` flags it returns are the on-chain truth, so a
 * market that has settled on-chain is reconciled here regardless of indexer
 * state; the existing settle/aggregate steps then award claims and points.
 */

export interface StuckMarketReconcileResult {
  scope: SyncScope;
  candidates: number;
  resolved: number;
  voided: number;
  stillPending: number;
  failed: { marketId: string; reason: string }[];
}

type StuckMarket = { id: string; onchain_market_id: string };

// Only rows past expiry by this grace window are candidates: it takes a moment
// for a market to move from expiry to on-chain resolution, and there is no
// point hammering a market that only just expired.
const GRACE_MS = 2 * 60_000;
// Bound the work per run. Oldest-stuck first, so any backlog drains over
// successive runs rather than reading every historical market at once.
const CANDIDATE_LIMIT = 200;
// Fan out on-chain reads in modest chunks — same shape as sync.ts, gentler on
// the RPC than one 200-wide Promise.all.
const READ_CHUNK = 25;
const READ_TIMEOUT_MS = 10_000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function withTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${READ_TIMEOUT_MS}ms`)), READ_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function reconcileStuckMarkets(scope: SyncScope): Promise<StuckMarketReconcileResult> {
  const admin = createSupabaseAdminClient();
  const cutoffIso = new Date(Date.now() - GRACE_MS).toISOString();

  // Candidates: past expiry, not yet settled to a concrete outcome, and not
  // already voided. This deliberately also re-captures rows that a prior
  // `syncResolvedMarkets` mislabeled as status='resolved' with a NULL outcome
  // (an unhandled void) — they have resolution_outcome NULL and status != voided.
  let query = admin
    .from("markets")
    .select("id, onchain_market_id")
    .is("resolution_outcome", null)
    .neq("status", "voided")
    .lt("expires_at", cutoffIso);
  if (scope !== "all") {
    query = query.eq("league_type", scope);
  }

  const { data, error } = await query
    .order("expires_at", { ascending: true })
    .limit(CANDIDATE_LIMIT);
  if (error) throw error;

  const candidates = (data ?? []) as StuckMarket[];
  const failed: StuckMarketReconcileResult["failed"] = [];
  let resolved = 0;
  let voided = 0;
  let stillPending = 0;

  if (candidates.length === 0) {
    return { scope, candidates: 0, resolved: 0, voided: 0, stillPending: 0, failed };
  }

  const exchange = getDreamDexReadClient();

  for (let i = 0; i < candidates.length; i += READ_CHUNK) {
    const chunk = candidates.slice(i, i + READ_CHUNK);
    const reads = await Promise.all(
      chunk.map(async (market) => {
        try {
          const onchain = await withTimeout(
            exchange.client.getMarketOnchain(market.onchain_market_id as `0x${string}`),
            `on-chain read for ${market.onchain_market_id}`,
          );
          return { market, onchain, error: null as unknown };
        } catch (readError) {
          return { market, onchain: null, error: readError };
        }
      }),
    );

    for (const { market, onchain, error: readError } of reads) {
      if (!onchain) {
        failed.push({ marketId: market.onchain_market_id, reason: errorMessage(readError) });
        continue;
      }

      // Void is decided by the on-chain flag alone — never by a null indexer
      // winner, which can simply mean "not indexed yet". A void redeems both
      // sides; settle-picks scores it 0 points, neither win nor loss.
      if (onchain.isVoided || onchain.status === 5) {
        const { error: updateError } = await admin
          .from("markets")
          .update({ status: "voided", last_synced_at: new Date().toISOString() })
          .eq("id", market.id);
        if (updateError) {
          failed.push({ marketId: market.onchain_market_id, reason: `db update failed: ${updateError.message}` });
          continue;
        }
        voided++;
        continue;
      }

      // Resolved with a concrete one-hot winner (0 = YES = up, 1 = NO = down).
      const isResolved = onchain.isResolved || onchain.status === 4;
      const outcome = onchain.winningOutcome === 0 ? "up" : onchain.winningOutcome === 1 ? "down" : null;
      if (isResolved && outcome) {
        const { error: updateError } = await admin
          .from("markets")
          .update({ status: "resolved", resolution_outcome: outcome, last_synced_at: new Date().toISOString() })
          .eq("id", market.id);
        if (updateError) {
          failed.push({ marketId: market.onchain_market_id, reason: `db update failed: ${updateError.message}` });
          continue;
        }
        resolved++;
        continue;
      }

      // Genuinely not settled on-chain yet (still listed/trading/locked/settling),
      // or the rare resolved-without-one-hot-winner partial. Leave it — do NOT
      // guess an outcome; the next run re-reads it.
      stillPending++;
    }
  }

  const result: StuckMarketReconcileResult = { scope, candidates: candidates.length, resolved, voided, stillPending, failed };
  console.log(
    `[worker][reconcile:${scope}] candidates=${candidates.length} resolved=${resolved} voided=${voided} pending=${stillPending} failed=${failed.length}`,
  );
  if (failed.length > 0) {
    console.warn(`[worker][reconcile:${scope}] read/update failures:`, failed.slice(0, 10));
  }
  return result;
}
