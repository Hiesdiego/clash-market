import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Own-score only — matches "secondary display, not a competing
 * leaderboard" from the build plan. No route exists (deliberately) to
 * fetch another user's Edge Score or a ranked list of everyone's.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: appUser } = await supabase.from("users").select("id").eq("auth_user_id", user.id).maybeSingle();

  // A signed-in visitor can open their profile before their Privy wallet has
  // been linked. That is an empty-score state, not a missing API route (or an
  // error the profile needs to surface).
  if (!appUser) {
    return NextResponse.json({
      edge_score: 50,
      sample_size: 0,
      percentile: null,
      trend: [],
    });
  }

  const admin = createSupabaseAdminClient();
  const [{ data: scoreRows, error: scoreError }, { data: percentile, error: percentileError }] = await Promise.all([
    admin.rpc("get_user_edge_score", { p_user_id: appUser.id }),
    admin.rpc("get_user_edge_percentile", { p_user_id: appUser.id }),
  ]);

  if (scoreError) return NextResponse.json({ error: scoreError.message }, { status: 500 });
  if (percentileError) return NextResponse.json({ error: percentileError.message }, { status: 500 });

  return NextResponse.json({ ...scoreRows?.[0], percentile: percentile ?? null });
}
