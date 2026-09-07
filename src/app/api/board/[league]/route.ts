import { NextRequest, NextResponse } from "next/server";
import { getCuratedBoard } from "@/lib/dreamdex/curation";
import { LEAGUE_TYPES, type LeagueType } from "@/lib/constants/leagues";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ league: string }> }) {
  const { league } = await params;
  if (!LEAGUE_TYPES.includes(league as LeagueType)) {
    return NextResponse.json({ error: `Unknown league "${league}"` }, { status: 400 });
  }

  try {
    const markets = await getCuratedBoard(league as LeagueType);
    return NextResponse.json({
      markets: markets.map((market) => {
        const snapshot = (market.raw_snapshot ?? {}) as Record<string, unknown>;
        const openingPrice = typeof snapshot.clashOpeningPrice === "number"
          && Number.isFinite(snapshot.clashOpeningPrice)
          ? snapshot.clashOpeningPrice
          : null;
        return { ...market, openingPrice };
      }),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load board" }, { status: 500 });
  }
}
