import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";


export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ user: null });

  const { data: appUser } = await supabase
    .from("users")
    .select("id, wallet_address, display_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ user: appUser ?? null });
}
