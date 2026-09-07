import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyPrivyAccessToken } from "@/lib/privy/verify";
import { getVerifiedPrivyUser } from "@/lib/privy/server-client";


export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const privyAccessToken = authHeader?.replace(/^Bearer\s+/i, "");

  if (!privyAccessToken) {
    return NextResponse.json({ error: "Missing Privy access token" }, { status: 401 });
  }

  // Who is the CURRENT anonymous Supabase session? This has to come
  // from the request's own cookies (the user's own session), never
  // from a client-supplied id, or a malicious client could link its
  // Privy identity onto someone else's session.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: supabaseUser },
    error: sessionError,
  } = await supabase.auth.getUser();

  if (sessionError || !supabaseUser) {
    return NextResponse.json(
      { error: "No active Supabase session — call signInAnonymously() first" },
      { status: 401 }
    );
  }

  let privyUserId: string;
  try {
    ({ privyUserId } = await verifyPrivyAccessToken(privyAccessToken));
  } catch {
    return NextResponse.json({ error: "Invalid Privy access token" }, { status: 401 });
  }

  let walletAddress: string;
  let privyWalletId: string | undefined;
  try {
    ({ walletAddress, privyWalletId } = await getVerifiedPrivyUser(privyUserId));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not resolve wallet from Privy" },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  // Referral attribution, real signal only: a `ref` query param
  // pointing at another real user's id, captured once at first link.
  const refParam = request.nextUrl.searchParams.get("ref");
  const isNewUser = !(await admin.from("users").select("id").eq("privy_user_id", privyUserId).maybeSingle()).data;

  const { data, error } = await admin
    .from("users")
    .upsert(
      {
        auth_user_id: supabaseUser.id,
        privy_user_id: privyUserId,
        wallet_address: walletAddress.toLowerCase(),
        privy_wallet_id: privyWalletId ?? null,
        ...(isNewUser && refParam && refParam !== supabaseUser.id && { referred_by: refParam }),
      },
      { onConflict: "privy_user_id" }
    )
    .select("id, wallet_address, display_name")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (isNewUser && refParam) {
    await admin.from("funnel_events").insert({
      event_type: "referral_signup",
      user_id: data.id,
      metadata: { referred_by: refParam },
    });
  }

  
  const { data: priorPractice } = await admin
    .from("practice_sessions")
    .select("id")
    .eq("anon_session_id", supabaseUser.id)
    .limit(1)
    .maybeSingle();

  if (priorPractice) {
    await admin.from("funnel_events").insert({
      event_type: "converted_from_practice",
      user_id: data.id,
      anon_session_id: supabaseUser.id,
    });
  }

  return NextResponse.json({ user: data, isNewUser });
}
