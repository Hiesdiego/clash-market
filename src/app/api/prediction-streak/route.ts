import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ streak: 0, authenticated: false });
  const { data: appUser } = await supabase.from("users").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!appUser) return NextResponse.json({ streak: 0, authenticated: true });
  const { data } = await createSupabaseAdminClient().from("prediction_streaks").select("current_streak").eq("user_id", appUser.id).maybeSingle();
  return NextResponse.json({ streak: data?.current_streak ?? 0, authenticated: true });
}
