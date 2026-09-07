import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LEAGUE_TYPES, type LeagueType } from "@/lib/constants/leagues";


export async function GET(request: NextRequest) {
  const leagueParam = request.nextUrl.searchParams.get("league");
  if (leagueParam && !LEAGUE_TYPES.includes(leagueParam as LeagueType)) {
    return NextResponse.json({ error: `Unknown league "${leagueParam}"` }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("get_clan_standings", { p_league_type: leagueParam ?? null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ standings: data });
}
