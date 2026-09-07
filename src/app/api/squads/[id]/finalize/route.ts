import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * "Build the post-submission receipt trail — every pick's transaction
 * reference stored and surfaced in the user's history, so
 * 'non-custodial, verifiable on-chain' is something a user can
 * actually go check." — build plan, Phase 4.
 *
 * Called by the client AFTER a real batched or sequential submission
 * already succeeded on-chain (see lib/squad-builder/submit.ts) — this
 * route never places an order itself, it only records what already
 * happened. Uses the admin client because flipping a squad out of
 * 'draft' is deliberately not something the client-scoped RLS policy
 * allows (0002_rls_policies.sql) — that transition is meant to go
 * through a trusted server path, and now it does.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: squadId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { picks, submittedTxHash, chipType } = body as {
    picks: {
      onchainMarketId: string;
      direction: "up" | "down";
      isCaptain: boolean;
      entryImpliedProbability: number;
      stakeUsd: number;
      onchainTxHash: string;
    }[];
    submittedTxHash: string;
    chipType?: "triple_captain" | "spotter" | null;
  };

  if (!picks?.length || !submittedTxHash) {
    return NextResponse.json({ error: "picks and submittedTxHash are required" }, { status: 400 });
  }
  if (chipType !== undefined && chipType !== null && chipType !== "triple_captain" && chipType !== "spotter") {
    return NextResponse.json({ error: "Invalid chip type" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // Ownership check — this route uses the admin client (needed to
  // bypass the draft-only RLS restriction on the status transition
  // itself), so it has to verify ownership manually rather than
  // relying on RLS to do it implicitly.
  const { data: squad, error: squadError } = await admin
    .from("squads")
    .select("id, user_id, status, chip_type")
    .eq("id", squadId)
    .single();
  if (squadError || !squad) {
    // The URL matched this handler. A missing draft is a state conflict (for
    // example, a stale tab after a round reset), not a missing Next.js route.
    return NextResponse.json(
      { error: "This draft squad is no longer available. Refresh the page and start a new squad." },
      { status: 409 }
    );
  }

  const { data: appUser } = await supabase.from("users").select("id").eq("auth_user_id", user.id).single();
  if (!appUser || squad.user_id !== appUser.id) {
    return NextResponse.json({ error: "Not your squad" }, { status: 403 });
  }
  if (squad.status !== "draft") {
    return NextResponse.json({ error: `Squad is already ${squad.status}` }, { status: 409 });
  }
  if (squad.chip_type !== null && squad.chip_type !== chipType) {
    return NextResponse.json({ error: "The selected chip does not match this draft" }, { status: 409 });
  }

  // Resolve each pick's internal market row id from its onchain id.
  const marketRows = await admin
    .from("markets")
    .select("id, onchain_market_id")
    .in(
      "onchain_market_id",
      picks.map((p) => p.onchainMarketId)
    );
  const marketIdByOnchain = new Map((marketRows.data ?? []).map((m) => [m.onchain_market_id, m.id]));

  const pickRows = picks.map((p) => {
    const marketId = marketIdByOnchain.get(p.onchainMarketId);
    if (!marketId) throw new Error(`Unknown market ${p.onchainMarketId}`);
    return {
      squad_id: squadId,
      market_id: marketId,
      direction: p.direction,
      is_captain: p.isCaptain,
      entry_implied_probability: p.entryImpliedProbability,
      stake_usd: p.stakeUsd,
      onchain_tx_hash: p.onchainTxHash,
    };
  });

  const { error: picksError } = await admin.from("picks").insert(pickRows);
  if (picksError) return NextResponse.json({ error: picksError.message }, { status: 500 });

  if (chipType) {
    const { error: chipError } = await admin.rpc("claim_league_chip", { p_squad_id: squadId, p_chip_type: chipType });
    if (chipError) {
      await admin.from("picks").delete().eq("squad_id", squadId);
      return NextResponse.json({ error: chipError.message }, { status: 409 });
    }
    const { error: chipUpdateError } = await admin.from("squads").update({ chip_type: chipType }).eq("id", squadId);
    if (chipUpdateError) return NextResponse.json({ error: chipUpdateError.message }, { status: 500 });
  }

  const { data: updatedSquad, error: updateError } = await admin
    .from("squads")
    .update({ status: "submitted", submitted_tx_hash: submittedTxHash, submitted_at: new Date().toISOString() })
    .eq("id", squadId)
    .select()
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ squad: updatedSquad });
}
