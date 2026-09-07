"use client";

import { useEffect, useState } from "react";
import { AccentProvider, type LeagueType } from "@/components/ui/accent-provider";
import { Eyebrow } from "@/components/ui/card";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { LEAGUE_CONFIG } from "@/lib/constants/leagues";

type Pick = {
  direction: string;
  outcome: string | null;
  markets?: { underlying: string; resolution_outcome: string | null } | null;
};
type Squad = {
  id: string;
  league_type: string;
  status: string;
  total_score: number;
  created_at: string;
  picks?: Pick[];
};

const LEAGUES: LeagueType[] = ["blitz", "classic", "horizon"];
function outcomeTone(outcome: string | null) {
  if (outcome === "correct") return "text-gain";
  if (outcome === "incorrect") return "text-loss";
  return "text-chalk-500";
}

export default function HistoryPage() {
  const [squads, setSquads] = useState<Squad[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/squads/history")
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw new Error(b.error);
        return b;
      })
      .then((b) => setSquads(b.squads ?? []))
      .catch((e) => {
        setError(e.message);
        setSquads([]);
      });
  }, []);

  return (
    <AccentProvider league="classic" as="main" className="min-h-screen px-5 py-10 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <Eyebrow>Your record</Eyebrow>
          <h1 className="mt-2 font-display text-4xl text-chalk-100">Squad history</h1>
          <p className="mt-2 text-sm text-chalk-500">Every squad you&apos;ve fielded, with picks and results.</p>
        </header>

        {error && <p className="text-sm text-loss">{error}</p>}

        {squads === null && (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        )}

        {squads !== null && !error && squads.length === 0 && (
          <EmptyState
            title="No squads yet"
            description="Field your first squad in any league and it will show up here the moment it settles."
          />
        )}

        <div className="space-y-4">
          {(squads ?? []).map((s) => {
            const league = (LEAGUES.includes(s.league_type as LeagueType) ? s.league_type : "classic") as LeagueType;
            const settled = s.status === "settled";
            return (
              <AccentProvider
                key={s.id}
                league={league}
                as="article"
                className="overflow-hidden rounded-2xl border border-chalk-800 bg-pitch-900/60"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-chalk-800 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Badge tone="accent">{LEAGUE_CONFIG[league].label}</Badge>
                    <span className="text-xs text-chalk-500">{new Date(s.created_at).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge tone={settled ? "gain" : "muted"}>{s.status}</Badge>
                    <span className="font-display text-2xl tabular-nums text-accent">
                      {Number(s.total_score || 0).toFixed(1)}
                      <span className="ml-1 text-xs font-normal text-chalk-500">pts</span>
                    </span>
                  </div>
                </div>
                <div className="grid gap-2 p-4 sm:grid-cols-2">
                  {(s.picks ?? []).map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-chalk-800/70 bg-pitch-950 px-3 py-2.5 text-sm"
                    >
                      <span className="min-w-0 truncate font-medium text-chalk-200">
                        {p.markets?.underlying ?? "Market"}
                        <span className="ml-2 text-xs font-semibold text-chalk-500">
                          {p.direction === "down" ? "CRASH" : "CLASH"}
                        </span>
                      </span>
                      <span className={`ml-3 shrink-0 text-xs font-semibold capitalize ${outcomeTone(p.outcome)}`}>
                        {p.outcome ?? "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              </AccentProvider>
            );
          })}
        </div>
      </div>
    </AccentProvider>
  );
}
