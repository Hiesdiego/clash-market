import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reconcileDuePositionsForUser } from "@/lib/scoring/reconcile-positions";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: appUser } = await supabase.from("users").select("id").eq("auth_user_id", user.id).single();
  if (!appUser) return NextResponse.json({ squads: [] });
  // A positions visit is an authenticated, rate-limited recovery trigger for
  // expired picks. It is deliberately best-effort: a temporary RPC/indexer
  // problem must not prevent the existing history from rendering.
  await reconcileDuePositionsForUser(appUser.id).catch((error) => {
    console.error("Position reconciliation failed", error);
  });
  const { data, error } = await supabase
    .from("squads")
    .select("*, picks(*, markets(id, onchain_market_id, underlying, window_length_seconds, resolution_outcome, status, expires_at))")
    .eq("user_id", appUser.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ squads: data ?? [] });
}
