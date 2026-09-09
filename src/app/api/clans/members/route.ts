import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const clanId = request.nextUrl.searchParams.get("clanId");
  if (!clanId) return NextResponse.json({ error: "clanId is required" }, { status: 400 });
  const { data, error } = await supabase.rpc("get_clan_members", { p_clan_id: clanId });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ members: data ?? [] });
}
