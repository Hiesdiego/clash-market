import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ClanStandingsTable } from "@/components/clans/clan-standings-table";
import { ClanPanel } from "@/components/clans/clan-panel";
import { AccentProvider } from "@/components/ui/accent-provider";
import { Eyebrow } from "@/components/ui/card";
import { LEAGUE_TYPES, LEAGUE_CONFIG, type LeagueType } from "@/lib/constants/leagues";

export default async function ClansPage() {
  const admin = createSupabaseAdminClient();
  const { data: standings, error } = await admin.rpc("get_clan_standings", { p_league_type: null });

  type ClanRow = NonNullable<typeof standings>[number];
  const byLeague = new Map<LeagueType, ClanRow[]>();
  for (const row of standings ?? []) {
    const lt = row.league_type as LeagueType;
    const arr = byLeague.get(lt) ?? [];
    arr.push(row);
    byLeague.set(lt, arr);
  }

  return (
    <main className="min-h-screen px-5 py-10 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Hero */}
        <section className="floodlight overflow-hidden rounded-3xl border border-chalk-800 bg-pitch-900/50 p-7 sm:p-10">
          <Eyebrow>Private leagues</Eyebrow>
          <h1 className="mt-3 font-display text-4xl leading-[0.95] text-chalk-100 sm:text-5xl">Clans</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-chalk-400">
            Rally a crew and pool your points. Each clan runs in one league, holds up to 20 members, and climbs on the
            combined score of everyone in it. Invite by link, register at two members, and take the top of the board.
          </p>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* League boards */}
          <div className="space-y-8">
            {LEAGUE_TYPES.map((lt) => (
              <AccentProvider key={lt} league={lt} as="section">
                <div className="mb-3 flex items-end justify-between">
                  <h2 className="font-display text-xl text-chalk-100">{LEAGUE_CONFIG[lt].label} clans</h2>
                  <Link href={`/clans/${lt}`} className="text-sm font-medium text-accent hover:brightness-110">
                    Full board →
                  </Link>
                </div>
                <ClanStandingsTable rows={(byLeague.get(lt) ?? []).slice(0, 5)} />
              </AccentProvider>
            ))}
            {error && <p className="text-sm text-loss">{error.message}</p>}
          </div>

          {/* Create / join / manage */}
          <aside>
            <AccentProvider league="classic">
              <ClanPanel />
            </AccentProvider>
          </aside>
        </div>
      </div>
    </main>
  );
}
