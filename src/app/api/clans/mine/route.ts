import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The caller's own clans, including each join_code (the shareable tag) which
 * the column-level GRANT in 0012 hides from direct table reads — get_my_clans
 * is SECURITY DEFINER, so this is how a member gets their code back to share.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase.rpc("get_my_clans");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ clans: data ?? [] });
}
