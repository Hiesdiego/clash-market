import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { joinCode } = body as { joinCode?: string };
  if (!joinCode) return NextResponse.json({ error: "joinCode is required" }, { status: 400 });

  const { data, error } = await supabase.rpc("join_clash_league", { p_join_code: joinCode });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ league: data });
}
