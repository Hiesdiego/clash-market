import "server-only";
import { getDreamDexReadClient } from "@/lib/dreamdex/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LeagueType } from "@/lib/supabase/database.types";

/**
 * Reads the live order book for a market and records a spread snapshot
 * — available as a targeted helper for callers that already have a
 * market-specific tradable symbol.
 * The snapshot is useful display data, but it is deliberately not a
 * visibility gate: DreamDEX's market inventory is the source of truth.
 */
export async function checkLiquidity(onchainMarketId: string, upSymbol: string) {
  const exchange = getDreamDexReadClient();
  const book = await exchange.fetchOrderBook(upSymbol, 5);

  const bestBid = book.bids[0]?.[0] ?? null;
  const bestAsk = book.asks[0]?.[0] ?? null;
  const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;

  const admin = createSupabaseAdminClient();
  await admin
    .from("markets")
    .update({
      best_bid: bestBid,
      best_ask: bestAsk,
      spread,
      book_checked_at: new Date().toISOString(),
    })
    .eq("onchain_market_id", onchainMarketId);

  return { bestBid, bestAsk, spread };
}

const SUPABASE_PAGE_SIZE = 1000;

/**
 * Return every live market in a league. The page size is only a PostgREST
 * transport detail; there is intentionally no result-count cap or liquidity
 * curation gate here.
 */
export async function getCuratedBoard(leagueType: LeagueType) {
  const admin = createSupabaseAdminClient();
  const expiresAfter = new Date().toISOString();
  const markets = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await admin
      .from("markets")
      .select("*")
      .eq("league_type", leagueType)
      .eq("status", "trading")
      .gt("expires_at", expiresAfter)
      .order("featured", { ascending: false })
      .order("expires_at", { ascending: true })
      .range(from, from + SUPABASE_PAGE_SIZE - 1);

    if (error) throw error;
    markets.push(...(data ?? []));
    if (!data || data.length < SUPABASE_PAGE_SIZE) break;
  }

  return markets;
}
