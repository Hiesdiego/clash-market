import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LEAGUE_TYPES, type LeagueType } from "@/lib/constants/leagues";


export async function GET(_request: NextRequest, { params }: { params: Promise<{ league: string }> }) {
  const { league } = await params;
  if (!LEAGUE_TYPES.includes(league as LeagueType)) {
    return NextResponse.json({ error: `Unknown league "${league}"` }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("get_league_standings", { p_league_type: league });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ standings: data });
}
