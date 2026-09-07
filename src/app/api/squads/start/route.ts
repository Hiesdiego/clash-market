import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureOpenRound } from "@/lib/squad-builder/rounds";
import { LEAGUE_TYPES, type LeagueType } from "@/lib/constants/leagues";
import { isMainnet } from "@/lib/env";

/**
 * Creates (or returns an existing) draft squad for the caller in the
 * current open round. Uses the admin client only for the round
 * lookup/creation step (rounds/seasons have no client insert policy by
 * design, per 0001's RLS) — the squad row itself is created with the
 * caller's own id, matching what `squads_insert_own` would allow
 * anyway, kept server-side here just to bundle both steps in one call.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { leagueType } = body as { leagueType?: string };
  if (!leagueType || !LEAGUE_TYPES.includes(leagueType as LeagueType)) {
    return NextResponse.json({ error: "Valid leagueType is required" }, { status: 400 });
  }

  const { data: appUser, error: appUserError } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (appUserError || !appUser) {
    return NextResponse.json({ error: "No linked Clash user for this session — connect a wallet first" }, { status: 404 });
  }

  // Staged rollout gate (Phase 9's league_types.live_enabled) —
  // testnet is deliberately unaffected, per the standing project
  // constraint that this build stays on testnet throughout. This flag
  // only ever blocks real submission once mainnet is in play.
  if (isMainnet()) {
    const admin = createSupabaseAdminClient();
    const { data: leagueRow } = await admin.from("league_types").select("live_enabled").eq("id", leagueType as LeagueType).single();
    if (!leagueRow?.live_enabled) {
      return NextResponse.json(
        { error: `${leagueType} isn't live yet — staged rollout, see docs/PHASE-9-OPS-RELIABILITY.md` },
        { status: 403 }
      );
    }
  }

  try {
    const { roundId } = await ensureOpenRound(leagueType as LeagueType);
    const admin = createSupabaseAdminClient();

    const { data: existing } = await admin
      .from("squads")
      .select("*")
      .eq("user_id", appUser.id)
      .eq("round_id", roundId)
      .maybeSingle();

    // Only a DRAFT squad is resumable. If the caller already has a squad in
    // this open round that's been submitted or settled, handing that same row
    // back is exactly the bug behind "squad already settled" — finalize then
    // 409s on the non-draft status, and it looks like a new submission somehow
    // shares a settled squad's id. It doesn't: start was returning the old row
    // because unique(user_id, round_id) forbids a second squad in the same
    // round and ensureOpenRound kept reusing that round.
    if (existing && existing.status === "draft") {
      return NextResponse.json({ squad: existing });
    }

    if (existing) {
      // Blitz is continuous — roll straight into a fresh round so the player
      // can enter again immediately. Classic/Horizon are one-squad-per-window
      // by design (daily/weekly), so a second entry is refused with a clear
      // reason rather than silently reusing the spent squad.
      if (leagueType !== "blitz") {
        return NextResponse.json(
          {
            error: `You've already entered this ${leagueType} round (your squad is ${existing.status}). It's one squad per round — the next one opens when this round closes.`,
          },
          { status: 409 }
        );
      }
      const { roundId: freshRoundId } = await ensureOpenRound(leagueType as LeagueType, { forceNew: true });
      const { data: rolledSquad, error: rolledError } = await admin
        .from("squads")
        .insert({ user_id: appUser.id, round_id: freshRoundId, league_type: leagueType as LeagueType, status: "draft" })
        .select()
        .single();
      if (rolledError) throw rolledError;
      return NextResponse.json({ squad: rolledSquad });
    }

    const { data: squad, error: squadError } = await admin
      .from("squads")
      .insert({ user_id: appUser.id, round_id: roundId, league_type: leagueType as LeagueType, status: "draft" })
      .select()
      .single();
    if (squadError) throw squadError;

    return NextResponse.json({ squad });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to start squad" }, { status: 500 });
  }
}
