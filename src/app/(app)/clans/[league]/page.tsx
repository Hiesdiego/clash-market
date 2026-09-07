import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ClanStandingsTable } from "@/components/clans/clan-standings-table";
import { AccentProvider } from "@/components/ui/accent-provider";
import { Eyebrow } from "@/components/ui/card";
import { LEAGUE_TYPES, LEAGUE_CONFIG, type LeagueType } from "@/lib/constants/leagues";

export default async function ClanLeaguePage({ params }: { params: Promise<{ league: string }> }) {
  const { league } = await params;
  if (!LEAGUE_TYPES.includes(league as LeagueType)) notFound();
  const leagueType = league as LeagueType;
  const config = LEAGUE_CONFIG[leagueType];

  const admin = createSupabaseAdminClient();
  const { data: standings, error } = await admin.rpc("get_clan_standings", { p_league_type: leagueType });

  return (
    <AccentProvider league={leagueType} as="main" className="min-h-screen">
      <section className="floodlight border-b border-chalk-800">
        <div className="mx-auto max-w-4xl px-5 py-12 lg:px-8">
          <div className="flex items-center justify-between text-sm">
            <Link href="/clans" className="text-chalk-500 transition-colors hover:text-chalk-300">← All clans</Link>
            <Link href={`/leagues/${leagueType}`} className="font-medium text-accent hover:brightness-110">
              {config.label} overall →
            </Link>
          </div>
          <div className="mt-8">
            <Eyebrow>{config.label} · Clans</Eyebrow>
            <h1 className="mt-2 font-display text-5xl leading-[0.95] tracking-tight text-chalk-100">Clan table</h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-chalk-400">
              Registered {config.label} clans, ranked by the combined {config.label} points of every member.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-10 lg:px-8">
        {error ? <p className="text-sm text-loss">{error.message}</p> : <ClanStandingsTable rows={standings ?? []} />}
      </section>
    </AccentProvider>
  );
}
