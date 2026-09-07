import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Owner-only registration gate: register_clan (SECURITY DEFINER) enforces that
 * the caller owns the clan and that it has >= 2 members before it goes on the
 * clan leaderboard.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { clanId } = body as { clanId?: string };
  if (!clanId) return NextResponse.json({ error: "clanId is required" }, { status: 400 });

  const { data, error } = await supabase.rpc("register_clan", { p_clan_id: clanId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ clan: data });
}
