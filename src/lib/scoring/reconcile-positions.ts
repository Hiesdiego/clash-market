import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LEAGUE_TYPES, type LeagueType } from "@/lib/constants/leagues";
import { runSettlementSweep } from "@/lib/scoring/run-settlement-sweep";
import { settleSoloTrades } from "@/lib/scoring/settle-solo-trades";

type PendingPick = {
  outcome: string | null;
  markets: { expires_at: string | null; league_type: LeagueType | null } | null;
};

let lastAttemptAt = 0;
let inFlight: Promise<void> | null = null;
const RECONCILE_COOLDOWN_MS = 15_000;


export async function reconcileDuePositionsForUser(userId: string): Promise<void> {
  const now = Date.now();
  if (inFlight) return inFlight;
  if (now - lastAttemptAt < RECONCILE_COOLDOWN_MS) return;
  lastAttemptAt = now;

  inFlight = (async () => {
    const admin = createSupabaseAdminClient();
    const [{ data: squads, error: squadsError }, { data: soloTrades, error: soloError }] = await Promise.all([
      admin
        .from("squads")
        .select("picks(outcome, markets(expires_at, league_type))")
        .eq("user_id", userId)
        .eq("status", "submitted"),
      admin.from("solo_trades").select("id").eq("user_id", userId).eq("status", "open"),
    ]);

    if (squadsError) throw squadsError;
    if (soloError) throw soloError;

    const dueLeagues = new Set<LeagueType>();
    for (const squad of squads ?? []) {
      for (const pick of ((squad.picks ?? []) as unknown as PendingPick[])) {
        const expiresAt = pick.markets?.expires_at ? Date.parse(pick.markets.expires_at) : NaN;
        if (pick.outcome === null && Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
          const league = pick.markets?.league_type;
          if (league && LEAGUE_TYPES.includes(league)) dueLeagues.add(league);
        }
      }
    }

    for (const league of dueLeagues) {
      await runSettlementSweep(league);
    }

    if ((soloTrades ?? []).length > 0) {
      await settleSoloTrades();
    }
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
