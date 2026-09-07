import Link from "next/link";
import { LEAGUE_CONFIG, LEAGUE_TYPES } from "@/lib/constants/leagues";

const ACCENTS = { blitz: "text-blitz", classic: "text-classic", horizon: "text-horizon" } as const;
const BORDERS = { blitz: "hover:border-blitz/60", classic: "hover:border-classic/60", horizon: "hover:border-horizon/60" } as const;
const CARD_NUMBERS = { blitz: "01", classic: "02", horizon: "03" } as const;
const CARD_GLOWS = { blitz: "bg-blitz/5", classic: "bg-classic/5", horizon: "bg-horizon/5" } as const;

export default function LeaguesPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_50%_0%,#183627_0%,#07110d_45%)]">
      <div className="mx-auto max-w-7xl px-5 pb-20 pt-12 lg:px-8">
        <section className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-classic">Compete with purpose</p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl leading-[.95] tracking-tight text-chalk-100 sm:text-7xl">
            Find your pace.
            <br />
            <span className="text-classic">Climb the table.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-chalk-400">
            Three ways to play, one live leaderboard. Choose the league that matches your appetite for speed and turn every call into points.
          </p>
          <p className="mt-5 font-display text-xl text-chalk-100 sm:text-2xl">
            Are you the best? <span className="text-classic">Prove it.</span>
          </p>
        </section>

        <section className="mt-16">
          <div className="flex items-end justify-between border-b border-chalk-800 pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-chalk-500">Choose your arena</p>
              <h2 className="mt-1 font-display text-2xl text-chalk-100">The leagues</h2>
            </div>
            <span className="text-xs text-chalk-600">Ranked every round</span>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            {LEAGUE_TYPES.map((type) => {
              const league = LEAGUE_CONFIG[type];
              return (
                <Link
                  key={type}
                  href={`/leagues/${type}`}
                  className={`group relative flex min-h-[25rem] flex-col overflow-hidden rounded-2xl border border-chalk-800 bg-pitch-900/90 p-6 transition duration-300 hover:-translate-y-2 ${BORDERS[type]}`}
                >
                  <div className={`pointer-events-none absolute inset-0 opacity-80 ${CARD_GLOWS[type]}`} />
                  <div className="relative flex items-start justify-between gap-4">
                    <span className={`font-display text-7xl leading-none tracking-tight ${ACCENTS[type]}`}>
                      {CARD_NUMBERS[type]}
                    </span>
                    <span className="mt-2 h-3 w-3 rounded-full border border-current opacity-70" aria-hidden="true" />
                  </div>
                  <div className="relative mt-7 h-px bg-gradient-to-r from-current via-current/30 to-transparent opacity-50" />
                  <div className="relative mt-6">
                    <p className={`text-xs font-bold uppercase tracking-[0.28em] ${ACCENTS[type]}`}>League</p>
                    <h3 className="mt-2 font-display text-5xl leading-none text-chalk-100">{league.label}</h3>
                  </div>
                  <div className="relative mt-auto flex items-center justify-between border-t border-chalk-800 pt-6">
                    <span className={`text-sm font-bold ${ACCENTS[type]}`}>Enter {league.label}</span>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full border border-current text-lg transition-transform duration-300 group-hover:translate-x-1 ${ACCENTS[type]}`} aria-hidden="true">
                      →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
