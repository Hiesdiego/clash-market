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
  const { name, slug, leagueType } = body as { name?: string; slug?: string; leagueType?: string };
  if (!name || !slug) return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  if (!leagueType || !LEAGUE_TYPES.includes(leagueType as LeagueType)) {
    return NextResponse.json({ error: "A valid league is required" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("create_clan", {
    p_name: name,
    p_slug: slug,
    p_league_type: leagueType,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ clan: data });
}
