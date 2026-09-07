import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Solo trades — direct bets placed from the discovery board or a market detail
 * page (see market-card-footer's trade mode). Unlike squad picks these aren't
 * part of the league points game; they're recorded here purely so /positions
 * can show them. Same auth shape as the squad routes: resolve the app `users`
 * row from the Supabase auth user, then read/write with the admin client
 * (scoped manually to that user's id).
 */

async function resolveAppUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const, status: 401 as const };
  const { data: appUser } = await supabase.from("users").select("id").eq("auth_user_id", user.id).single();
  if (!appUser) return { error: "No linked Clash user for this session — connect a wallet first" as const, status: 404 as const };
  return { userId: appUser.id };
}

export async function GET() {
  const resolved = await resolveAppUserId();
  if ("error" in resolved) {
    // An unauthenticated caller just has no solo trades — don't make /positions error out.
    return NextResponse.json({ trades: [] });
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("solo_trades")
    .select("*")
    .eq("user_id", resolved.userId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trades: data ?? [] });
}

export async function POST(request: NextRequest) {
  const resolved = await resolveAppUserId();
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const body = await request.json();
  const { onchainMarketId, underlying, question, direction, stakeUsd, entryImpliedProbability, onchainTxHash } = body as {
    onchainMarketId?: string;
    underlying?: string;
    question?: string | null;
    direction?: "up" | "down";
    stakeUsd?: number;
    entryImpliedProbability?: number | null;
    onchainTxHash?: string;
  };

  if (!onchainMarketId || (direction !== "up" && direction !== "down") || !onchainTxHash || !(Number(stakeUsd) > 0)) {
    return NextResponse.json({ error: "onchainMarketId, direction, stakeUsd and onchainTxHash are required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // Best-effort link to a synced market row (null for uncurated markets).
  const { data: marketRow } = await admin
    .from("markets")
    .select("id")
    .eq("onchain_market_id", onchainMarketId)
    .maybeSingle();

  const { data: trade, error } = await admin
    .from("solo_trades")
    .insert({
      user_id: resolved.userId,
      onchain_market_id: onchainMarketId,
      market_id: marketRow?.id ?? null,
      underlying: String(underlying ?? "Market"),
      question: question ?? null,
      direction,
      stake_usd: Number(stakeUsd),
      entry_implied_probability: entryImpliedProbability != null ? Number(entryImpliedProbability) : null,
      onchain_tx_hash: onchainTxHash,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ trade });
}
