interface StandingRow {
  rank: number;
  cumulative_score: number;
  rounds_played: number;
  display_name: string | null;
  wallet_address: string;
}

/**
 * One table component for Overall and private clan standings, rather than
 * bespoke layouts per screen — the same "learn the game once" principle the
 * single squad format follows. The top three get podium emphasis; scores read
 * in the live league accent.
 */
const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-chalk-800 px-6 py-12 text-center">
        <p className="text-sm text-chalk-400">No scored rounds yet.</p>
        <p className="mt-1 text-xs text-chalk-600">Play a round and you&apos;ll be the first name on the board.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-chalk-800 bg-pitch-900/60">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 border-b border-chalk-800 px-3 py-3 text-[11px] uppercase tracking-widest text-chalk-500 sm:grid-cols-[auto_1fr_auto_auto] sm:gap-4 sm:px-5">
        <span>Rank</span>
        <span>Player</span>
        <span className="hidden text-right sm:block">Rounds</span>
        <span className="text-right">Points</span>
      </div>
      <ul>
        {rows.map((row) => {
          const isPodium = row.rank <= 3;
          return (
            <li
              key={row.wallet_address}
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
              <span className="min-w-0 truncate font-medium text-chalk-100">
                {row.display_name ?? `${row.wallet_address.slice(0, 6)}…${row.wallet_address.slice(-4)}`}
              </span>
              <span className="hidden text-right font-mono text-sm tabular-nums text-chalk-400 sm:block">{row.rounds_played}</span>
              <span className={`text-right font-display text-lg tabular-nums ${isPodium ? "text-accent" : "text-chalk-100"}`}>
                {row.cumulative_score.toFixed(1)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
