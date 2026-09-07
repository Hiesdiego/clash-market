import "server-only";

import { syncResolvedMarkets } from "@/lib/dreamdex/sync";
import { settlePicksForLeague, type SettlementResult } from "@/lib/scoring/settle-picks";
import { aggregateSquadScoresForLeague, type AggregationResult } from "@/lib/scoring/aggregate";
import type { LeagueType } from "@/lib/constants/leagues";

export interface SettlementSweepResult {
  resolved: Awaited<ReturnType<typeof syncResolvedMarkets>>;
  settlement: SettlementResult;
  aggregation: AggregationResult;
}


export async function runSettlementSweep(leagueType: LeagueType): Promise<SettlementSweepResult> {
  const resolved = await syncResolvedMarkets(leagueType);
  const settlement = await settlePicksForLeague(leagueType);
  const aggregation = await aggregateSquadScoresForLeague(leagueType);
  return { resolved, settlement, aggregation };
}
