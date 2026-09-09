import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ClanPanel } from "@/components/clans/clan-panel";
import { ClanMemberStandingsTable } from "@/components/clans/clan-member-standings-table";
import { AccentProvider } from "@/components/ui/accent-provider";
import { Eyebrow } from "@/components/ui/card";
import type { LeagueType } from "@/lib/constants/leagues";

export default async function ClansPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: clans } = user ? await supabase.rpc("get_my_clans") : { data: [] };
  const clan = clans?.[0];
  const { data: standings, error } = clan
    ? await supabase.rpc("get_clan_member_standings", { p_clan_id: clan.id })
    : { data: [], error: null };

  const initialClans = (clans ?? []).map((item) => ({
    ...item,
    registered_leagues: item.registered_leagues as LeagueType[],
  }));

  return (
    <main className="min-h-screen px-5 py-10 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="floodlight overflow-hidden rounded-3xl border border-chalk-800 bg-pitch-900/50 p-7 sm:p-10">
          <Eyebrow>Private league</Eyebrow>
          <h1 className="mt-3 font-display text-4xl leading-[0.95] text-chalk-100 sm:text-5xl">Your clan</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-chalk-400">
            Your clan table is private to its members. Points are accumulated from every league the clan is registered for.
          </p>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section>
            {clan ? <>
              <div className="mb-3 flex items-end justify-between"><div><h2 className="font-display text-xl text-chalk-100">{clan.name} standings</h2><p className="mt-1 text-sm text-chalk-500">Only clan members can view this table.</p></div></div>
              {error ? <p className="text-sm text-loss">{error.message}</p> : <ClanMemberStandingsTable rows={standings ?? []} />}
            </> : <div className="rounded-2xl border border-dashed border-chalk-800 p-8 text-center"><p className="text-sm text-chalk-400">Join or start a clan to see its private table.</p></div>}
          </section>
          <aside><AccentProvider league="classic"><ClanPanel initialClans={initialClans} /></AccentProvider></aside>
        </div>
      </div>
    </main>
  );
}
