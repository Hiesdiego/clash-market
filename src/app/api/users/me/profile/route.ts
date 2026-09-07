import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("users").select("id, wallet_address, display_name, created_at").eq("auth_user_id", user.id).maybeSingle();
  return data;
}

export async function GET() {
  const user = await getCurrentUser();
  return user ? NextResponse.json({ user }) : NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await request.json() as { displayName?: string };
  const displayName = body.displayName?.trim().replace(/\s+/g, " ");
  if (!displayName || displayName.length < 2 || displayName.length > 32) return NextResponse.json({ error: "Use a name between 2 and 32 characters." }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const { data: existingNames } = await admin.from("users").select("id, display_name").not("display_name", "is", null);
  const duplicate = existingNames?.some((candidate) => candidate.id !== user.id && candidate.display_name?.trim().toLocaleLowerCase() === displayName.toLocaleLowerCase());
  if (duplicate) return NextResponse.json({ error: "That username or team name is already taken." }, { status: 409 });
  const { data, error } = await admin.from("users").update({ display_name: displayName }).eq("id", user.id).select("id, wallet_address, display_name, created_at").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "That username or team name is already taken." : error.message }, { status: error.code === "23505" ? 409 : 500 });
  return NextResponse.json({ user: data });
}
