import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await request.json() as { clanId?: string; newOwnerId?: string };
  if (!body.clanId || !body.newOwnerId) {
    return NextResponse.json({ error: "clanId and newOwnerId are required" }, { status: 400 });
  }
  const { data, error } = await supabase.rpc("transfer_clan_ownership", {
    p_clan_id: body.clanId,
    p_new_owner_id: body.newOwnerId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ clan: data });
}
