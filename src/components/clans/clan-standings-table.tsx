interface ClanStandingRow {
  rank: number;
  clan_id: string;
  clan_name: string;
  member_count: number;
  clan_total: number;
}

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function ClanStandingsTable({ rows }: { rows: ClanStandingRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-chalk-800 px-6 py-12 text-center">
        <p className="text-sm text-chalk-400">No registered clans here yet.</p>
        <p className="mt-1 text-xs text-chalk-600">Start a clan, recruit two members, and register to claim the top spot.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-chalk-800 bg-pitch-900/60">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 border-b border-chalk-800 px-3 py-3 text-[11px] uppercase tracking-widest text-chalk-500 sm:grid-cols-[auto_1fr_auto_auto] sm:gap-4 sm:px-5">
        <span>Rank</span>
        <span>Clan</span>
        <span className="hidden text-right sm:block">Members</span>
        <span className="text-right">Total</span>
      </div>
      <ul>
        {rows.map((row) => {
          const isPodium = row.rank <= 3;
          return (
            <li
              key={row.clan_id}
              className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-chalk-800/60 px-3 py-3 transition-colors last:border-0 hover:bg-chalk-950/40 sm:grid-cols-[auto_1fr_auto_auto] sm:gap-4 sm:px-5 ${
                row.rank === 1 ? "bg-accent/5" : ""
              }`}
            >
              <span className="flex w-8 items-center justify-center">
                {isPodium ? (
                  <span className="text-lg" aria-label={`Rank ${row.rank}`}>{MEDALS[row.rank]}</span>
                ) : (
                  <span className="font-mono text-sm tabular-nums text-chalk-500">{row.rank}</span>
                )}
              </span>
              <span className="min-w-0 truncate font-medium text-chalk-100">{row.clan_name}</span>
              <span className="hidden text-right font-mono text-sm tabular-nums text-chalk-400 sm:block">{row.member_count}</span>
              <span className={`text-right font-display text-lg tabular-nums ${isPodium ? "text-accent" : "text-chalk-100"}`}>
                {row.clan_total.toFixed(1)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
