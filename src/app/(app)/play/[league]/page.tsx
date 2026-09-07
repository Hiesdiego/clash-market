import { notFound } from "next/navigation";
import Link from "next/link";
import { SquadBuilder } from "@/components/squad-builder/squad-builder";
import { AccentProvider } from "@/components/ui/accent-provider";
import { LEAGUE_TYPES, LEAGUE_CONFIG, type LeagueType } from "@/lib/constants/leagues";


export default async function PlayPage({ params }: { params: Promise<{ league: string }> }) {
  const { league } = await params;
  if (!LEAGUE_TYPES.includes(league as LeagueType)) notFound();
  const leagueType = league as LeagueType;
  const eyebrow = leagueType === "blitz" ? "Fast hands" : leagueType === "classic" ? "Make it count" : "Play the long game";

  return (
    <AccentProvider league={leagueType} as="main" className="min-h-screen floodlight px-5 py-8 lg:px-8">
      <div className="mx-auto mb-8 flex max-w-6xl flex-col gap-4 rounded-2xl border border-accent/20 bg-accent/5 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
            <p className="mt-1 text-sm text-chalk-300">
              Build your {LEAGUE_CONFIG[leagueType].label} squad, captain your conviction, and chase the next settlement.
            </p>
          </div>
          <Link href={`/leagues/${leagueType}`} className="whitespace-nowrap text-sm font-semibold text-accent hover:brightness-110">
            League table →
          </Link>
        </div>
        {/* League switcher — jump straight to another league's board (#3). */}
        <div className="flex flex-wrap items-center gap-2 border-t border-accent/15 pt-3">
          <span className="text-xs uppercase tracking-widest text-chalk-500">Switch league</span>
          <div className="flex gap-1.5">
            {LEAGUE_TYPES.map((l) => {
              const active = l === leagueType;
              return (
                <Link
                  key={l}
                  href={`/play/${l}`}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-[color:var(--accent-contrast)]"
                      : "rounded-lg border border-chalk-700 px-3 py-1.5 text-sm font-medium text-chalk-300 transition hover:border-chalk-400 hover:text-chalk-100"
                  }
                >
                  {LEAGUE_CONFIG[l].label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl">
        <SquadBuilder leagueType={leagueType} />
      </div>
    </AccentProvider>
  );
}
