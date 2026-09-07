import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { syncMarketsForLeague, syncResolvedMarkets } from "@/lib/dreamdex/sync";
import { LEAGUE_TYPES, type LeagueType } from "@/lib/constants/leagues";

/**
 * One route per league so an external scheduler can genuinely run these
 * on the plan's three different clocks:
 *   - Blitz:   every ~1-2 min (a round is always live, somewhere)
 *   - Classic: a few times a day
 *   - Horizon: daily is plenty for a weekly-window market
 *
 * Real scheduling (Vercel Cron, or Phase 9's dedicated worker) is
 * infrastructure config, not application code — this route is what
 * that scheduler calls. Protected by a shared secret since it mutates
 * `markets`; not meant to be publicly triggerable.
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
    const [liveResult, resolvedResult] = await Promise.all([
      syncMarketsForLeague(leagueType),
      syncResolvedMarkets(leagueType),
    ]);

    return NextResponse.json({ live: liveResult, resolved: resolvedResult });
  } catch (err) {
    console.error(`Sync failed for league ${leagueType}`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}