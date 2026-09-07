import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LEAGUE_CONFIG, type LeagueType } from "@/lib/constants/leagues";

/**
 * Real gap found while building Phase 4, not anticipated earlier: a
 * squad's `round_id` is a required FK (0001_init_schema.sql), but
 * nothing creates a `rounds` row — that's Phase 6's job ("Build the
 * season/round-accumulation logic per league cadence"). A squad
 * literally cannot exist without one, so this pulls forward the
 * minimal real version rather than leaving Phase 4 undemoable or
 * faking a round row.
 *
 * "Minimal" is doing real work here: round boundaries are computed
 * from each league's actual cadence, not arbitrary. Full season
 * lifecycle (multi-season history, explicit rollover jobs, standings
 * reset) is still Phase 6's — this only ever ensures ONE open round
 * exists right now, on demand.
 */
export async function ensureOpenRound(
  leagueType: LeagueType,
  options: { forceNew?: boolean } = {}
): Promise<{ roundId: string; seasonId: string }> {
  const admin = createSupabaseAdminClient();
  const now = new Date();

  const { data: activeSeason, error: seasonReadError } = await admin
    .from("seasons")
    .select("id")
    .eq("league_type", leagueType)
    .eq("is_active", true)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (seasonReadError) throw seasonReadError;

  let seasonId = activeSeason?.id;
  if (!seasonId) {
    const { data: newSeason, error: seasonInsertError } = await admin
      .from("seasons")
      .insert({
        league_type: leagueType,
        label: `${LEAGUE_CONFIG[leagueType].label} — Season 1`,
        starts_at: now.toISOString(),
        is_active: true,
      })
      .select("id")
      .single();
    if (seasonInsertError) throw seasonInsertError;
    seasonId = newSeason.id;
  }

  // `forceNew` skips reuse and always mints a fresh round. Used when the
  // caller's previous squad in the current open round is already spent
  // (submitted/settled) and the league's cadence is continuous (Blitz), so
  // the player can immediately enter the next round rather than being
  // pinned to a finished one by unique(user_id, round_id). Reuse is the
  // default — one open round per league at a time.
  if (!options.forceNew) {
    const { data: openRound, error: roundReadError } = await admin
      .from("rounds")
      .select("id, locks_at")
      .eq("season_id", seasonId)
      .eq("status", "open")
      .gt("locks_at", now.toISOString())
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (roundReadError) throw roundReadError;

    if (openRound) return { roundId: openRound.id, seasonId };
  }

  const { startsAt, locksAt, endsAt } = computeRoundWindow(leagueType, now);

  const { data: newRound, error: roundInsertError } = await admin
    .from("rounds")
    .insert({
      season_id: seasonId,
      league_type: leagueType,
      starts_at: startsAt.toISOString(),
      locks_at: locksAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "open",
    })
    .select("id")
    .single();
  if (roundInsertError) throw roundInsertError;

  return { roundId: newRound.id, seasonId };
}

/**
 * Round boundaries per league, matching each league's real cadence
 * (LEAGUE_CONFIG) rather than one generic "24h round" for everyone:
 *   - Blitz: locks in 20 minutes (a fresh round is always starting soon)
 *   - Classic: locks at the end of the current UTC day
 *   - Horizon: locks at the end of the current UTC week (Sunday)
 */
function computeRoundWindow(leagueType: LeagueType, now: Date) {
  if (leagueType === "blitz") {
    const locksAt = new Date(now.getTime() + 20 * 60 * 1000);
    return { startsAt: now, locksAt, endsAt: locksAt };
  }

  if (leagueType === "classic") {
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    return { startsAt: now, locksAt: endOfDay, endsAt: endOfDay };
  }

  // horizon — end of the current UTC week (next Sunday 00:00 UTC)
  const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
  const endOfWeek = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilSunday, 0, 0, 0)
  );
  return { startsAt: now, locksAt: endOfWeek, endsAt: endOfWeek };
}
