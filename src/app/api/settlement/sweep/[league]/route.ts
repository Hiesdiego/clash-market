import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { runSettlementSweep } from "@/lib/scoring/run-settlement-sweep";
import { settleSoloTrades } from "@/lib/scoring/settle-solo-trades";
import { LEAGUE_TYPES, type LeagueType } from "@/lib/constants/leagues";

/**
 * The Phase 5 counterpart to Phase 3's /api/sync/[league] — same
 * shared-secret-gated, externally-triggerable pattern, same honest
 * framing: this route is fine for manual triggers and Vercel Cron
 * today, but the actual 24/7 scheduling of it in production belongs
 * on a Railway-style always-on worker (see docs/PHASE-5-SCORING-REDEMPTION.md
 * for the full reasoning) — Next.js serverless functions have
 * execution-time limits and no persistent process, neither of which
 * this route tries to work around.
 *
 * Runs three real steps in order: catch any newly-resolved markets
 * (reuses Phase 3's syncResolvedMarkets, since a market can resolve
 * between Blitz's own sync cadence and this sweep), score any
 * newly-scoreable picks, then roll those scores up into squad totals.
 * Redemption automation is deliberately NOT called from here yet —
 * it has one unconfirmed piece (see redemption/privy-server-client.ts)
 * and shouldn't run unattended until that's resolved.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ league: string }> }) {
  const env = getEnv();
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.SYNC_JOB_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { league } = await params;
  if (!LEAGUE_TYPES.includes(league as LeagueType)) {
    return NextResponse.json({ error: `Unknown league "${league}"` }, { status: 400 });
  }
  const leagueType = league as LeagueType;

  try {
    const { resolved, settlement, aggregation } = await runSettlementSweep(leagueType);
    const soloTrades = await settleSoloTrades();

    return NextResponse.json({ resolved, settlement, aggregation, soloTrades });
  } catch (err) {
    console.error(`Settlement sweep failed for league ${leagueType}`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Settlement sweep failed" },
      { status: 500 }
    );
  }
}
