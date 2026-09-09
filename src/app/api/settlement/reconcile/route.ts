import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { reconcileStuckMarkets } from "@/lib/scoring/reconcile-stuck-markets";
import { settlePicksForLeague, type SettlementResult } from "@/lib/scoring/settle-picks";
import { aggregateSquadScoresForLeague, type AggregationResult } from "@/lib/scoring/aggregate";
import { settleSoloTrades } from "@/lib/scoring/settle-solo-trades";
import { LEAGUE_TYPES } from "@/lib/constants/leagues";

/**
 * Manual "fix now" trigger for markets that have settled on-chain but are
 * still stuck non-terminal in our DB (gotcha #1 — the indexer lags). Same
 * shared-secret gate as /api/settlement/sweep/[league], but scope "all" in a
 * single call: reconcile straight from chain, then settle the picks and squads
 * of every league it just fixed, then the solo trades.
 *
 * The worker's `reconcile-stuck-markets` job does this on a ~5-minute cadence
 * already; this route only exists so the current backlog can be cleared
 * immediately after deploy (or wired to a cron) without waiting for the tick.
 */
export async function POST(request: NextRequest) {
  const env = getEnv();
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.SYNC_JOB_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Read authoritative on-chain state for every stuck market across all
    //    leagues (and uncurated/solo rows with league_type = null).
    const reconciled = await reconcileStuckMarkets("all");

    // 2. Score the picks + roll up the squads of every league whose markets the
    //    reconcile just moved to a terminal state.
    const settlement: SettlementResult[] = [];
    const aggregation: AggregationResult[] = [];
    for (const league of LEAGUE_TYPES) {
      settlement.push(await settlePicksForLeague(league));
      aggregation.push(await aggregateSquadScoresForLeague(league));
    }

    // 3. Solo trades are not league-scoped — settle them in the same pass.
    const soloTrades = await settleSoloTrades();

    return NextResponse.json({ reconciled, settlement, aggregation, soloTrades });
  } catch (err) {
    console.error("Settlement reconcile failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Settlement reconcile failed" },
      { status: 500 }
    );
  }
}
