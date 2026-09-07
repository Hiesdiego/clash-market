import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LeagueType } from "@/lib/constants/leagues";

export interface AggregationResult {
  leagueType: LeagueType;
  squadsUpdated: number;
  squadsSettled: number;
}


export async function aggregateSquadScoresForLeague(leagueType: LeagueType): Promise<AggregationResult> {
  const admin = createSupabaseAdminClient();

  const { data: submittedSquads, error } = await admin
    .from("squads")
    .select("id, picks(points_awarded, outcome)")
    .eq("league_type", leagueType)
    .eq("status", "submitted");

  if (error) throw error;
  if (!submittedSquads || submittedSquads.length === 0) {
    return { leagueType, squadsUpdated: 0, squadsSettled: 0 };
  }

  let squadsUpdated = 0;
  let squadsSettled = 0;

  for (const squad of submittedSquads) {
    const picks = squad.picks as unknown as { points_awarded: number | null; outcome: string | null }[];
    if (picks.length === 0) continue;

    const allScored = picks.every((p) => p.outcome !== null);
    const totalScore = picks.reduce((sum, p) => sum + (p.points_awarded ?? 0), 0);

    const { error: updateError } = await admin
      .from("squads")
      .update({
        total_score: totalScore,
        ...(allScored && { status: "settled" }),
      })
      .eq("id", squad.id);
    if (updateError) throw updateError;


    if (allScored) {
      const { data: squadRow } = await admin
        .from("squads")
        .select("user_id, round_id, league_type")
        .eq("id", squad.id)
        .single();
      if (squadRow) {
        const { error: cardError } = await admin.from("matchday_cards").insert({
          user_id: squadRow.user_id,
          round_id: squadRow.round_id,
          league_type: squadRow.league_type,
          squad_snapshot: { picks, total_score: totalScore },
        });
        if (cardError) console.error("Failed to write matchday_cards row", cardError);
      }
    }

    squadsUpdated++;
    if (allScored) squadsSettled++;
  }

  return { leagueType, squadsUpdated, squadsSettled };
}
