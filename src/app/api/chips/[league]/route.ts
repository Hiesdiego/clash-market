import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CHIPS_PER_SEASON, LEAGUE_TYPES, type LeagueType } from "@/lib/constants/leagues";

export async function GET(_request: Request, { params }: { params: Promise<{ league: string }> }) {
  const { league } = await params;
  if (!LEAGUE_TYPES.includes(league as LeagueType)) return NextResponse.json({ error: "Invalid league" }, { status: 400 });
  const leagueType = league as LeagueType;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: appUser } = await supabase.from("users").select("id").eq("auth_user_id", user.id).single();
  if (!appUser) return NextResponse.json({ error: "No linked Clash user" }, { status: 404 });
  const admin = createSupabaseAdminClient();
  const { data: season } = await admin.from("seasons").select("id").eq("league_type", leagueType).eq("is_active", true).order("starts_at", { ascending: false }).limit(1).maybeSingle();
  if (!season) return NextResponse.json({ triple_captain: CHIPS_PER_SEASON, spotter: CHIPS_PER_SEASON });
  const { data: uses } = await admin.from("league_chip_uses").select("chip_type").eq("user_id", appUser.id).eq("season_id", season.id).eq("league_type", leagueType);
  const used = (uses ?? []).reduce((counts, row) => ({ ...counts, [row.chip_type]: (counts[row.chip_type] ?? 0) + 1 }), {} as Record<string, number>);
  return NextResponse.json({ triple_captain: CHIPS_PER_SEASON - (used.triple_captain ?? 0), spotter: CHIPS_PER_SEASON - (used.spotter ?? 0) });
}
