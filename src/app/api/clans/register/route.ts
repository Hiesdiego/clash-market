import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LEAGUE_TYPES, type LeagueType } from "@/lib/constants/leagues";

/**
 * Owner-only registration gate: register_clan (SECURITY DEFINER) enforces that
 * the caller owns the clan and that it has >= 2 members before that league is
 * added to the clan's private table.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { clanId, leagueType } = body as { clanId?: string; leagueType?: string };
  if (!clanId || !leagueType) return NextResponse.json({ error: "clanId and leagueType are required" }, { status: 400 });
  if (!LEAGUE_TYPES.includes(leagueType as LeagueType)) {
    return NextResponse.json({ error: "A valid league is required" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("register_clan", { p_clan_id: clanId, p_league_type: leagueType });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ clan: data });
}
