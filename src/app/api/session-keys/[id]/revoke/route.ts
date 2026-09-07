import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 *
 * TODO before this is actually trustworthy end-to-end: this currently
 * only flips our own DB row to 'revoked'. It does NOT yet call Privy's
 * server API to actually deauthorize the signer on Privy's side — that
 * call's exact shape (likely something under `privy.policies()` or a
 * per-wallet signer-removal endpoint) needs to be confirmed against
 * Privy's current docs before this route is complete. Shipping the DB
 * half now, flagging the gap explicitly rather than claiming this
 * fully revokes access when it doesn't yet.
 */

// VERDICT: Not fullproof - EARTHTRADER
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // RLS (session_keys_update_own) enforces this can only touch the
  // caller's own row — no need to re-check ownership here.
  const { data, error } = await supabase
    .from("session_keys")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    sessionKey: data,
    warning:
      "One-tap play is now off in Clash. If you granted an on-chain signer to your wallet, remove it from your wallet's connected-apps settings to fully revoke on-chain access.",
  });
}