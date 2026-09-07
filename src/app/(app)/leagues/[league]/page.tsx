import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { StandingsTable } from "@/components/leagues/standings-table";
import { ScoringExplainer } from "@/components/leagues/scoring-explainer";
import { AccentProvider } from "@/components/ui/accent-provider";
import { Eyebrow } from "@/components/ui/card";
import { LEAGUE_CONFIG, LEAGUE_TYPES, type LeagueType } from "@/lib/constants/leagues";

export default async function LeagueStandingsPage({ params }: { params: Promise<{ league: string }> }) {
  const { league } = await params;
  if (!LEAGUE_TYPES.includes(league as LeagueType)) notFound();
  const leagueType = league as LeagueType;
  const config = LEAGUE_CONFIG[leagueType];

  const admin = createSupabaseAdminClient();
  const { data: standings, error } = await admin.rpc("get_league_standings", { p_league_type: leagueType });
  const players = standings?.length ?? 0;

  return (
    <AccentProvider league={leagueType} as="main" className="min-h-screen">
      {/* Hero — the league is the spine of the whole product, so give its table a stage. */}
      <section className="floodlight border-b border-chalk-800">
        <div className="mx-auto max-w-5xl px-5 py-12 lg:px-8">
          <div className="flex items-center justify-between text-sm">
            <Link href="/leagues" className="text-chalk-500 transition-colors hover:text-chalk-300">← All leagues</Link>
            <Link href="/clans" className="font-medium text-accent hover:brightness-110">Private leagues →</Link>
          </div>

          <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
            <div>
              <Eyebrow>{config.label} · Overall</Eyebrow>
              <h1 className="mt-2 max-w-xl font-display text-5xl leading-[0.95] tracking-tight text-chalk-100">
                {config.tagline}
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-chalk-400">
                Every round you play adds to your season total — no knockouts, no cutoffs. Keep making sharp calls and climb.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Link
                  href={`/play/${leagueType}`}
                  className="inline-flex h-11 items-center rounded-xl bg-accent px-6 font-display text-base font-semibold text-[color:var(--accent-contrast)] shadow-lg shadow-black/20 transition hover:brightness-110"
                >
                  Play {config.label}
                </Link>
                <ScoringExplainer />
              </div>
            </div>

            <div className="rounded-2xl border border-chalk-800 bg-pitch-900/60 px-6 py-5 text-center">
              <p className="font-display text-4xl tabular-nums text-accent">{players}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-chalk-500">on the board</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-10 lg:px-8">
        <h2 className="mb-4 font-display text-xl text-chalk-100">Season table</h2>
        {error ? (
          <p className="text-sm text-loss">{error.message}</p>
        ) : (
          <StandingsTable rows={standings ?? []} />
        )}
      </section>
    </AccentProvider>
  );
}
