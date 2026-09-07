import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_SESSION_KEY_TTL_DAYS } from "@/lib/session-keys/policy";


export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { publicAddress } = body as { publicAddress?: string };

  if (!publicAddress) {
    return NextResponse.json({ error: "publicAddress is required" }, { status: 400 });
  }

  const { data: appUser, error: appUserError } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  if (appUserError || !appUser) {
    return NextResponse.json({ error: "No linked Clash user for this session" }, { status: 404 });
  }

  const expiresAt = new Date(Date.now() + DEFAULT_SESSION_KEY_TTL_DAYS * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("session_keys")
    .insert({
      user_id: appUser.id,
      public_address: publicAddress.toLowerCase(),
      scope: { trade: true, redeem: true, withdraw: false },
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessionKey: data });
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // RLS (session_keys_select_own) already scopes this to the caller's
  // own rows — no extra filtering needed here.
  const { data, error } = await supabase
    .from("session_keys")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessionKeys: data });
}