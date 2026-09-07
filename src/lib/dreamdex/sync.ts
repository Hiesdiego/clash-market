import "server-only";
import type { BinaryMarket } from "@somnia-chain/markets-sdk";
import { getDreamDexReadClient } from "@/lib/dreamdex/client";
import {
  classifyMarketForAllMarkets,
} from "@/lib/dreamdex/classify";
import { parseOpeningPrice } from "@/lib/dreamdex/opening-price";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LeagueType } from "@/lib/constants/leagues";
import type { MarketStatus } from "@/lib/supabase/database.types";

// Lifecycle values per market-structure.md — the indexer/on-chain read
// returns numeric status; this is the only place that mapping happens.
const ONCHAIN_STATUS_MAP: Record<number, MarketStatus> = {
  0: "listed",
  1: "trading",
  2: "locked",
  4: "resolved",
  5: "voided",
  // 3 (Settling) is documented as effectively never observable — if it
  // shows up, the `?? undefined` fallback below will skip the row and
  // log rather than crash the whole sync run on one weird market.
};

export type SyncScope = LeagueType | "all";

export interface SyncResult {
  leagueType: SyncScope;
  scanned: number;
  upserted: number;
  skipped: { marketId: string; reason: string }[];
}

// Finalized markets are identical for every league scope. Keep one shared
// request (including a short-lived failure) so a slow indexer cannot be hit
// once for blitz, classic, horizon, and solo at the same time.
const FINALIZED_CACHE_TTL_MS = 15_000;
const INDEXER_RETRY_DELAYS_MS = [500, 1_500, 3_000] as const;
const LIVE_MARKET_PAGE_SIZE = 500;
const READ_TIMEOUT_MS = 10_000;
let finalizedCache: {
  at: number;
  markets?: BinaryMarket[];
  error?: unknown;
} | null = null;
let finalizedInflight: Promise<BinaryMarket[]> | null = null;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRetryableIndexerError(error: unknown): boolean {
  return /timeout|aborted|network|fetch failed|failed to fetch|temporarily unavailable|\b(429|500|502|503|504)\b/i.test(
    errorMessage(error),
  );
}

async function withReadTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
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

async function loadFinalizedMarkets(
  exchange: ReturnType<typeof getDreamDexReadClient>,
): Promise<BinaryMarket[]> {
  const now = Date.now();
  if (finalizedCache && now - finalizedCache.at < FINALIZED_CACHE_TTL_MS) {
    if (finalizedCache.error) throw finalizedCache.error;
    return finalizedCache.markets ?? [];
  }
  if (finalizedInflight) return finalizedInflight;

  finalizedInflight = (async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= INDEXER_RETRY_DELAYS_MS.length; attempt++) {
      try {
        // The discovery feed intentionally spans the full binary inventory.
        // Keep settlement on the same inventory or picks on a market from a
        // second DreamDEX venue can never be reconciled.
        return await withReadTimeout(
          exchange.client.listBinaryMarkets({ status: "Finalized" }),
          "finalized-market indexer request",
        );
      } catch (error) {
        lastError = error;
        if (!isRetryableIndexerError(error) || attempt === INDEXER_RETRY_DELAYS_MS.length) throw error;
        const delay = INDEXER_RETRY_DELAYS_MS[attempt];
        console.warn(`[worker] finalized-market indexer request failed; retrying in ${delay}ms: ${errorMessage(error)}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  })()
    .then((markets) => {
      finalizedCache = { at: Date.now(), markets };
      return markets;
    })
    .catch((error) => {
      // Cache failures briefly too. Otherwise four scope-specific settlement
      // calls would each repeat the same retry storm while the indexer is down.
      finalizedCache = { at: Date.now(), error };
      throw error;
    })
    .finally(() => {
      finalizedInflight = null;
    });

  return finalizedInflight;
}

async function loadLiveMarkets(exchange: ReturnType<typeof getDreamDexReadClient>) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= INDEXER_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const markets: BinaryMarket[] = [];
      for (let offset = 0; ; offset += LIVE_MARKET_PAGE_SIZE) {
        const page = await withReadTimeout(
          exchange.client.listLiveBinaryMarkets({
            limit: LIVE_MARKET_PAGE_SIZE,
            offset,
          }),
          "live-market indexer request",
        );
        markets.push(...page);
        if (page.length < LIVE_MARKET_PAGE_SIZE) break;
      }
      return markets;
    } catch (error) {
      lastError = error;
      if (!isRetryableIndexerError(error) || attempt === INDEXER_RETRY_DELAYS_MS.length) throw error;
      const delay = INDEXER_RETRY_DELAYS_MS[attempt];
      console.warn(`[worker] live-market indexer request failed; retrying in ${delay}ms: ${errorMessage(error)}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

/**
 * Pulls only currently-live binary markets, gates every one on live on-chain
 * status (gotcha #1 — the indexer lags), classifies by typed fields only
 * (gotcha #13), and upserts into `markets`. The league boards use the
 * classifier's non-null league; the discovery feed also retains valid binary
 * markets whose cadence Clash does not curate yet.
 */
async function syncMarkets(scope: SyncScope): Promise<SyncResult> {
  const exchange = getDreamDexReadClient();
  const admin = createSupabaseAdminClient();

  const allMarkets = await loadLiveMarkets(exchange);
  console.log(`[worker][sync:${scope}] loaded ${allMarkets.length} markets from DreamDEX`);
  const skipped: SyncResult["skipped"] = [];
  let upserted = 0;
  let scanned = 0;
  let bookTops: Record<string, { bestBid: string | null; bestAsk: string | null }> = {};

  try {
    bookTops = await withReadTimeout(
      exchange.client.getBookTops(allMarkets.map((market) => market.marketId)),
      "book-top indexer request",
    );
  } catch (error) {
    // Book data is display metadata only. A transient indexer book failure must
    // not hide a market that passed the lifecycle checks below.
    console.warn(`[worker][sync:${scope}] book-top snapshot unavailable:`, errorMessage(error));
  }

  let openingPrices: Record<string, string | null> = {};
  try {
    openingPrices = await withReadTimeout(
      exchange.client.getOpeningPrices(allMarkets.map((market) => market.marketId)),
      "opening-price indexer request",
    );
  } catch (error) {
    // Opening price is scoring/display metadata. Keep syncing if the oracle
    // answer lookup is temporarily unavailable.
    console.warn(`[worker][sync:${scope}] opening-price snapshot unavailable:`, errorMessage(error));
  }

  const onchainStates = await Promise.all(
    allMarkets.map(async (info) => {
      try {
        const onchain = await withReadTimeout(
          exchange.client.getMarketOnchain(info.marketId),
          `on-chain status read for ${info.marketId}`,
        );
        return { info, onchain, error: null };
      } catch (error) {
        return { info, onchain: null, error };
      }
    }),
  );

  for (const state of onchainStates) {
    const { info } = state;
    scanned++;

    const intervalSec = Number(info.intervalSec);
    if (!Number.isFinite(intervalSec) || intervalSec <= 0) {
      skipped.push({ marketId: info.marketId, reason: `invalid intervalSec=${info.intervalSec}` });
      continue;
    }

    const classified = classifyMarketForAllMarkets(info.asset, intervalSec);

    // The all-markets feed is deliberately broader than the three curated
    // boards. A scoped sync still persists an uncurated cadence so a scheduler
    // that only invokes /api/sync/{league} cannot make it disappear from the
    // discovery feed; it is stored with league_type = null and never appears
    // on a curated board.
    if (
      scope !== "all"
      && classified.leagueType !== scope
      && classified.leagueType !== null
    ) continue;

    if (state.onchain === null) {
      skipped.push({ marketId: info.marketId, reason: `on-chain status read failed: ${errorMessage(state.error)}` });
      continue;
    }

    // Gotcha #1 — gate on LIVE on-chain status, never trust the
    // indexer's cached status for anything that decides pickability.
    const onchain = state.onchain;
    const status = ONCHAIN_STATUS_MAP[onchain.status];
    if (!status) {
      skipped.push({ marketId: info.marketId, reason: `unmapped on-chain status ${onchain.status}` });
      continue;
    }

    // Timestamps: the LIVE on-chain expiry is authoritative (bigint unix
    // seconds; 0n means the contract hasn't set it). MarketOnchain carries no
    // start time, so opens comes from the indexer's tradingStart (unix seconds
    // as a string). Both were previously produced by two helpers that probed
    // guessed field names ("expiresAt"/"opensAt"/…) that don't exist on
    // MarketOnchain, so they always returned null.
    const expiresAtSeconds = onchain.expiry > 0n ? Number(onchain.expiry) : null;
    const tradingStartSeconds = Number(info.tradingStart);
    const opensAtSeconds = Number.isFinite(tradingStartSeconds) && tradingStartSeconds > 0 ? tradingStartSeconds : null;

    // getOpeningPrices returns a Record<lowercasedMarketId, rawValue|null> — read
    // it via parseOpeningPrice, which also applies the oracle price scale. (See
    // opening-price.ts: reading opening[0] here used to make this always null.)
    const openingPrice = parseOpeningPrice(openingPrices, info.marketId);

    const top = bookTops[info.marketId.toLowerCase()];
    const bestBid = top?.bestBid != null ? Number(top.bestBid) / 10 ** info.quoteDecimals : null;
    const bestAsk = top?.bestAsk != null ? Number(top.bestAsk) / 10 ** info.quoteDecimals : null;
    const spread = bestBid != null && bestAsk != null ? bestAsk - bestBid : null;
    const rawInfo = JSON.parse(JSON.stringify(info)) as Record<string, unknown>;

    const { error } = await admin.from("markets").upsert(
      {
        onchain_market_id: info.marketId,
        underlying: classified.underlying,
        league_type: classified.leagueType,
        window_length_seconds: classified.windowLengthSeconds,
        opens_at: opensAtSeconds ? new Date(opensAtSeconds * 1000).toISOString() : new Date().toISOString(),
        expires_at: expiresAtSeconds
          ? new Date(expiresAtSeconds * 1000).toISOString()
          : new Date(Date.now() + classified.windowLengthSeconds * 1000).toISOString(),
        status,
        best_bid: bestBid,
        best_ask: bestAsk,
        spread,
        book_checked_at: new Date().toISOString(),
        raw_snapshot: {
          // Keep `info` for compatibility with the existing discovery/detail
          // serializers while also retaining the complete SDK market row at
          // the top level for future consumers.
          ...rawInfo,
          info: rawInfo,
          clashOpeningPrice: openingPrice,
        },
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "onchain_market_id" }
    );

    if (error) {
      skipped.push({ marketId: info.marketId, reason: `db upsert failed: ${error.message}` });
      continue;
    }
    upserted++;

  }

  const result = { leagueType: scope, scanned, upserted, skipped };
  console.log(
    `[worker][sync:${scope}] scanned=${scanned} upserted=${upserted} skipped=${skipped.length}`,
  );
  if (skipped.length > 0) {
    console.warn(`[worker][sync:${scope}] skip reasons:`, skipped.slice(0, 10));
  }
  return result;
}

export async function syncMarketsForLeague(leagueType: LeagueType): Promise<SyncResult> {
  return syncMarkets(leagueType);
}

/**
 * Separate pass for markets that have already resolved. Required
 * because of gotcha #10: `loadMarkets()` silently drops finalized
 * binaries, so the loop above will NEVER see a market transition into
 * "resolved" — it just stops appearing. Without this pass, a market
 * that resolves sits in our cache forever showing its last-seen live
 * status (locked, most likely), which would misrepresent it if
 * anything ever reads `markets.status` expecting it to be current.
 */
export async function syncResolvedMarkets(scope: SyncScope): Promise<SyncResult> {
  const exchange = getDreamDexReadClient();
  const admin = createSupabaseAdminClient();

  let finalized: BinaryMarket[];
  try {
    finalized = await loadFinalizedMarkets(exchange);
  } catch (error) {
    // Settlement can safely retry on the next scheduled sweep. Do not turn a
    // temporary indexer outage into a failed reconciliation request, and do
    // not process partial finalized data.
    const reason = `finalized-market indexer unavailable: ${errorMessage(error)}`;
    console.warn(`[worker][resolved:${scope}] ${reason}`);
    return { leagueType: scope, scanned: 0, upserted: 0, skipped: [{ marketId: "*", reason }] };
  }
  console.log(`[worker][resolved:${scope}] loaded ${finalized.length} finalized markets`);
  const skipped: SyncResult["skipped"] = [];
  let upserted = 0;
  let scanned = 0;

  for (const market of finalized) {
    // `market` is already a BinaryMarket (listBinaryMarkets' element type) —
    // no cast needed.
    scanned++;

    if (scope !== "all") {
      const intervalSec = Number(market.intervalSec);
      if (!Number.isFinite(intervalSec) || intervalSec <= 0) {
        skipped.push({ marketId: market.marketId, reason: `invalid intervalSec=${market.intervalSec}` });
        continue;
      }
      const classified = classifyMarketForAllMarkets(market.asset, intervalSec);
      // Keep uncurated finalized rows reconciled as well. They are not scored
      // by a league because their database league_type is null, but their
      // lifecycle must still be correct in the all-markets cache.
      if (classified.leagueType !== scope && classified.leagueType !== null) continue;
    }

    // winningOutcome is the contract's outcome index (0 = YES, 1 = NO); this
    // app models YES as "up" and NO as "down" — the same mapping used for the
    // #YES/#NO order refs in lib/squad-builder/submit.ts. null/anything else
    // = not resolved to a concrete side.
    const resolutionOutcome =
      market.winningOutcome === 0 ? "up" : market.winningOutcome === 1 ? "down" : null;

    const { error } = await admin
      .from("markets")
      .update({
        status: "resolved",
        resolution_outcome: resolutionOutcome,
        last_synced_at: new Date().toISOString(),
      })
      .eq("onchain_market_id", market.marketId);

    if (error) {
      skipped.push({ marketId: market.marketId, reason: `db update failed: ${error.message}` });
      continue;
    }
    upserted++;
  }

  const result = { leagueType: scope, scanned, upserted, skipped };
  console.log(
    `[worker][resolved:${scope}] scanned=${scanned} upserted=${upserted} skipped=${skipped.length}`,
  );
  if (skipped.length > 0) {
    console.warn(`[worker][resolved:${scope}] skip reasons:`, skipped.slice(0, 10));
  }
  return result;
}

/** Synchronize every venue market for the home discovery feed. */
export async function syncAllMarkets(): Promise<SyncResult[]> {
  return [await syncMarkets("all"), await syncResolvedMarkets("all")];
}
