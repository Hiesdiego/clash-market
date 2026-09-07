import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { scorePick, isUnderdogGiantKilling } from "@/lib/squad-builder/pricing";
import type { LeagueType } from "@/lib/constants/leagues";

export interface SettlementResult {
  leagueType: LeagueType;
  picksScored: number;
  giantKillings: string[]; // pick ids
}


export async function settlePicksForLeague(leagueType: LeagueType): Promise<SettlementResult> {
  const admin = createSupabaseAdminClient();

  const { data: unscored, error } = await admin
    .from("picks")
    .select("id, direction, is_captain, entry_implied_probability, squad_id, market_id, squads!inner(chip_type), markets!inner(resolution_outcome, status, league_type, underlying)")
    .is("outcome", null)
    .in("markets.status", ["resolved", "voided"])
    .eq("markets.league_type", leagueType);

  if (error) throw error;
  if (!unscored || unscored.length === 0) return { leagueType, picksScored: 0, giantKillings: [] };

  const giantKillings: string[] = [];

  for (const pick of unscored) {
    const market = pick.markets as unknown as {
      resolution_outcome: "up" | "down" | null;
      underlying: string;
      status: "resolved" | "voided";
    };

    // Voided market: DreamDEX redeems both sides at 0.5 regardless of
    // direction (gotcha #11) — neither a win nor a loss. Scored as a
    // real, distinct outcome ('voided'), not shoehorned into
    // correct/incorrect. Points: 0, since nothing was actually risked
    // or rewarded — the stake comes back via redemption, not via
    // points, and a voided pick shouldn't move a squad's total either
    // direction.
    if (market.status === "voided") {
      const { error: voidUpdateError } = await admin
        .from("picks")
        .update({ outcome: "voided", points_awarded: 0, settled_at: new Date().toISOString() })
        .eq("id", pick.id);
      if (voidUpdateError) throw voidUpdateError;
      continue;
    }

    if (!market.resolution_outcome) {

      continue;
    }

    const correct = pick.direction === market.resolution_outcome;
    const squad = pick.squads as unknown as { chip_type: "triple_captain" | "spotter" | null };
    const points = scorePick(pick.entry_implied_probability, correct, pick.is_captain, squad.chip_type);
    const giantKilling = isUnderdogGiantKilling(pick.entry_implied_probability, correct, pick.is_captain);

    const { error: updateError } = await admin
      .from("picks")
      .update({ outcome: correct ? "correct" : "incorrect", points_awarded: points, settled_at: new Date().toISOString() })
      .eq("id", pick.id);
    if (updateError) throw updateError;


    const marketDetails = market;
    const { error: wallError } = await admin.from("live_wall_events").insert({
      league_type: leagueType,
      underlying: marketDetails.underlying ?? "UNKNOWN",
      direction: pick.direction,
      is_captain: pick.is_captain,
      outcome: correct ? "correct" : "incorrect",
      points_awarded: points,
      is_giant_killing: giantKilling,
    });
    if (wallError) console.error("Failed to write live_wall_event", wallError);

    if (giantKilling) {
      giantKillings.push(pick.id);
    }
  }

  return { leagueType, picksScored: unscored.length, giantKillings };
}
