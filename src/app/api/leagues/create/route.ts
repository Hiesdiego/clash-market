import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LEAGUE_TYPES, type LeagueType } from "@/lib/constants/leagues";


export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { name, leagueType } = body as { name?: string; leagueType?: string };
  if (!name || !leagueType || !LEAGUE_TYPES.includes(leagueType as LeagueType)) {
    return NextResponse.json({ error: "name and a valid leagueType are required" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("create_clash_league", {
    p_name: name,
    p_league_type: leagueType,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ league: data });
}
