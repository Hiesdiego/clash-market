import "server-only";

import { syncResolvedMarkets } from "@/lib/dreamdex/sync";
import { reconcileStuckMarkets, type StuckMarketReconcileResult } from "@/lib/scoring/reconcile-stuck-markets";
import { settlePicksForLeague, type SettlementResult } from "@/lib/scoring/settle-picks";
import { aggregateSquadScoresForLeague, type AggregationResult } from "@/lib/scoring/aggregate";
import type { LeagueType } from "@/lib/constants/leagues";

export interface SettlementSweepResult {
  resolved: Awaited<ReturnType<typeof syncResolvedMarkets>>;
  reconciled: StuckMarketReconcileResult;
  settlement: SettlementResult;
  aggregation: AggregationResult;
}


export async function runSettlementSweep(leagueType: LeagueType): Promise<SettlementSweepResult> {
  // 1. Fast path: catch markets the indexer already reports as Finalized.
  const resolved = await syncResolvedMarkets(leagueType);
  // 2. Backstop: read straight from chain for any market that is past expiry
  //    but still non-terminal in our DB, so an indexer lag/miss (gotcha #1)
  //    can never strand a settled market — and its picks — as "settling".
  const reconciled = await reconcileStuckMarkets(leagueType);
  // 3. Score every pick whose market is now terminal, then roll up squad totals.
  const settlement = await settlePicksForLeague(leagueType);
  const aggregation = await aggregateSquadScoresForLeague(leagueType);
  return { resolved, reconciled, settlement, aggregation };
}
