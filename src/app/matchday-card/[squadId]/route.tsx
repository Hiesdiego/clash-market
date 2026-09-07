import { ImageResponse } from "next/og";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LEAGUE_CONFIG, type LeagueType } from "@/lib/constants/leagues";

export const runtime = "edge";

const ACCENT_HEX: Record<LeagueType, string> = {
  blitz: "#ff5a36",
  classic: "#ffd23f",
  horizon: "#5ec8ff",
};

const CARD_TITLE: Record<LeagueType, string> = {
  blitz: "Session Recap",
  classic: "Matchday Card",
  horizon: "Weekly Report Card",
};

/**
 * "The Matchday Card: at day's end, every player gets an
 * auto-generated, shareable card — squad, captain, hits/misses, final
 * score, league movement — sized for X/Discord... a distinct card
 * style per league (a Blitz 'session recap,' a Classic 'Matchday
 * Card,' a Horizon 'Weekly Report Card')." — build plan, Phase 7.
 *
 * Uses `next/og`'s `ImageResponse` — a real, built-in Next.js feature
 * (not a third-party image-generation service), rendered fresh from
 * the squad's actual picks each time this URL is hit rather than
 * pre-rendered and cached, so the image is always accurate even if
 * viewed before every pick in the squad has settled.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ squadId: string }> }) {
  const { squadId } = await params;
  const admin = createSupabaseAdminClient();

  const { data: squad, error } = await admin
    .from("squads")
    .select("*, picks(*, markets(underlying)), users(display_name, wallet_address)")
    .eq("id", squadId)
    .single();

  if (error || !squad) {
    return new Response("Squad not found", { status: 404 });
  }

  const leagueType = squad.league_type as LeagueType;
  const accent = ACCENT_HEX[leagueType];
  // `as unknown as` (like `squad.users` below): with the stopgap Database
  // type carrying no Relationships metadata, postgrest-js can't resolve the
  // squads→picks embed at the type level and widens it to a SelectQueryError,
  // but the embedded select is valid PostgREST and returns the real array at
  // runtime. Regenerating database.types.ts via `supabase gen types` would
  // populate relationships and remove the need for this cast.
  const picks = (squad.picks ?? []) as unknown as {
    direction: string;
    is_captain: boolean;
    outcome: string | null;
    points_awarded: number | null;
    entry_implied_probability: number;
    markets: { underlying: string } | null;
  }[];
  const player = squad.users as unknown as { display_name: string | null; wallet_address: string };
  const playerLabel = player?.display_name ?? `${player?.wallet_address?.slice(0, 6)}...${player?.wallet_address?.slice(-4)}`;

  const wins = picks.filter((p) => p.outcome === "correct").length;
  const losses = picks.filter((p) => p.outcome === "incorrect").length;
  const voids = picks.filter((p) => p.outcome === "voided").length;
  const pending = picks.filter((p) => p.outcome === null).length;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#07110d",
          padding: "48px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: accent, fontSize: 28, textTransform: "uppercase", letterSpacing: 4 }}>
            {LEAGUE_CONFIG[leagueType].label} · {CARD_TITLE[leagueType]}
          </span>
          <span style={{ color: "#8ea297", fontSize: 22 }}>{playerLabel}</span>
        </div>

        <div style={{ display: "flex", marginTop: 24, alignItems: "baseline" }}>
          <span style={{ color: "#f4f7f4", fontSize: 96, fontWeight: 700 }}>
            {squad.total_score.toFixed(1)}
          </span>
          <span style={{ color: "#8ea297", fontSize: 28, marginLeft: 16 }}>points</span>
        </div>

        <div style={{ display: "flex", marginTop: 12, gap: 24 }}>
          <span style={{ color: "#3ddc84", fontSize: 26 }}>{wins}W</span>
          <span style={{ color: "#ff5566", fontSize: 26 }}>{losses}L</span>
          {voids > 0 ? <span style={{ color: "#8ea297", fontSize: 26 }}>{voids} void</span> : null}
          {pending > 0 ? <span style={{ color: "#8ea297", fontSize: 26 }}>{pending} pending</span> : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 32, gap: 12 }}>
          {picks.map((pick, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26 }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ color: "#f4f7f4" }}>
                  {pick.markets?.underlying ?? "?"} {pick.direction.toUpperCase()}
                  {pick.is_captain ? " \u2605" : ""}
                </span>
                <span style={{ color: "#6b7d72", fontSize: 18 }}>
                  entry {(pick.entry_implied_probability * 100).toFixed(0)}%
                </span>
              </div>
              <span
                style={{
                  color:
                    pick.outcome === "correct" ? "#3ddc84" : pick.outcome === "incorrect" ? "#ff5566" : "#8ea297",
                }}
              >
                {pick.outcome === "voided"
                  ? "void"
                  : pick.points_awarded !== null
                  ? `${pick.points_awarded > 0 ? "+" : ""}${pick.points_awarded.toFixed(1)}`
                  : "pending"}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", marginTop: "auto", color: "#4d5f54", fontSize: 20 }}>
          Clash Markets — draft the market, captain your conviction.
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
