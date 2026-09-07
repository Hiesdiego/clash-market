import type { LeagueType } from "@/lib/constants/leagues";

/**
 * Classifies a market by its typed `intervalSec` field into one of the
 * three leagues — never by parsing the question string, which the
 * DreamDEX skill explicitly warns has changed wording before and will
 * again (gotcha #13).
 *
 * Keep the league boundaries broad enough to accept every current binary
 * cadence from DreamDEX, including its 5-minute Blitz markets:
 *   - Blitz:   60s-900s (short windows)
 *   - Classic: 3600s-14400s (1h-4h) — matches the original "1-4 hour" intent exactly
 *   - Horizon: 86400s (24h) — the longest current venue window
 * Boundaries must stay identical to supabase/seed.sql's league_types
 * rows and lib/constants/leagues.ts's LEAGUE_CONFIG — all three
 * hardcoded rather than generated from one source (mixed SQL/TS), so
 * changing one without the others is a real drift risk, flagged in all
 * three files.
 */
const LEAGUE_WINDOW_SECONDS: Record<LeagueType, { min: number; max: number }> = {
  blitz: { min: 60, max: 900 },
  classic: { min: 3600, max: 14400 },
  horizon: { min: 86400, max: 86400 },
};

export interface ClassifiedMarket {
  underlying: string;
  leagueType: LeagueType;
  windowLengthSeconds: number;
}

export interface AllMarketsClassification {
  underlying: string;
  /** Null means DreamDEX has a cadence Clash does not curate yet. */
  leagueType: LeagueType | null;
  windowLengthSeconds: number;
}

export class UnclassifiableMarketError extends Error {}

/**
 * Classify a market for the discovery feed. The discovery feed is broader
 * than the league boards: a valid DreamDEX market with a new cadence should
 * still be visible there, but must not be assigned to a curated league by
 * accident.
 */
export function classifyMarketForAllMarkets(asset: string, intervalSec: number): AllMarketsClassification {
  try {
    return classifyMarket(asset, intervalSec);
  } catch (err) {
    if (err instanceof UnclassifiableMarketError) {
      return { underlying: asset, leagueType: null, windowLengthSeconds: intervalSec };
    }
    throw err;
  }
}

export function classifyMarket(asset: string, intervalSec: number): ClassifiedMarket {
  const leagueType = (Object.keys(LEAGUE_WINDOW_SECONDS) as LeagueType[]).find((league) => {
    const { min, max } = LEAGUE_WINDOW_SECONDS[league];
    return intervalSec >= min && intervalSec <= max;
  });

  if (!leagueType) {
    throw new UnclassifiableMarketError(
      `intervalSec=${intervalSec} doesn't fall into any league window (blitz 60-900, classic 3600-14400, horizon 86400) — likely a DreamDEX window length Clash doesn't curate for yet.`
    );
  }

  return { underlying: asset, leagueType, windowLengthSeconds: intervalSec };
}
