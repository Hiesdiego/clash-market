"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCountdown } from "@/components/markets/market-countdown";
import { marketPath } from "@/components/markets/market-card";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ShareButtons } from "@/components/ui/share-buttons";
import { somniaTestnet } from "@/lib/chains/somnia";
import { cn } from "@/lib/cn";


type MarketMeta = {
  id: string;
  onchain_market_id: string;
  underlying: string;
  window_length_seconds: number;
  resolution_outcome: "up" | "down" | null;
  status: string;
  expires_at: string | null;
};
type Pick = {
  id: string;
  direction: "up" | "down";
  is_captain: boolean;
  entry_implied_probability: number;
  stake_usd: number;
  outcome: "correct" | "incorrect" | "voided" | null;
  points_awarded: number | null;
  settled_at: string | null;
  markets: MarketMeta | null;
};
type Squad = {
  id: string;
  league_type: string;
  status: string;
  total_score: number;
  submitted_at: string | null;
  created_at: string;
  picks: Pick[];
};

const PAGE_SIZE = 8;

function PageControls({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  const pageCount = Math.ceil(total / PAGE_SIZE);
  if (pageCount <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-chalk-500">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        className="rounded-lg border border-chalk-700 px-3 py-1.5 transition hover:border-chalk-400 hover:text-chalk-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>
      <span className="font-mono tabular-nums">Page {page + 1} of {pageCount}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(pageCount - 1, page + 1))}
        disabled={page === pageCount - 1}
        className="rounded-lg border border-chalk-700 px-3 py-1.5 transition hover:border-chalk-400 hover:text-chalk-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}

// Direct board bets (not squad picks) — see market-card-footer + /api/solo-trades.
type SoloTrade = {
  id: string;
  onchain_market_id: string;
  underlying: string;
  question: string | null;
  direction: "up" | "down";
  stake_usd: number;
  entry_implied_probability: number | null;
  onchain_tx_hash: string;
  status: string;
  outcome: "correct" | "incorrect" | "voided" | null;
  created_at: string;
  settled_at: string | null;
};

function projectedPoints(entry: number, isCaptain: boolean): number {
  // Mirror of scorePick(): correct = (1 − entry_implied_probability) × 10, ×2 if captain.
  return (1 - entry) * 10 * (isCaptain ? 2 : 1);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function marketHref(market: MarketMeta | null): string | null {
  if (!market) return null;
  return marketPath({
    id: market.onchain_market_id,
    asset: market.underlying,
    question: `${market.underlying} — up or down by expiry?`,
    windowSeconds: market.window_length_seconds,
  });
}

function OpenPositionRow({ pick, expiresAt }: { pick: Pick; expiresAt: string | null }) {
  // useCountdown is a hook — always call it. When there's no expiry we feed it
  // 0 (renders "settling…" via the expired branch below).
  const countdown = useCountdown(expiresAt ?? 0);
  const potential = projectedPoints(pick.entry_implied_probability, pick.is_captain);
  const showClock = expiresAt !== null && !countdown.expired;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-chalk-800 bg-pitch-950/60 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {marketHref(pick.markets) ? (
            <Link href={marketHref(pick.markets)!} className="truncate font-medium text-chalk-100 hover:text-accent">
              {pick.markets?.underlying ?? "Market"}
            </Link>
          ) : <span className="truncate font-medium text-chalk-100">{pick.markets?.underlying ?? "Market"}</span>}
          <Badge tone={pick.direction === "up" ? "gain" : "loss"}>{pick.direction === "up" ? "CLASH" : "CRASH"}</Badge>
          {pick.is_captain && <Badge tone="accent" dot>Captain</Badge>}
        </div>
        <p className="mt-1 text-xs text-chalk-500">
          Entry {(pick.entry_implied_probability * 100).toFixed(0)}% · ${pick.stake_usd.toFixed(2)} staked
        </p>
      </div>
      <div className="text-right">
        <p className={cn("font-mono text-sm tabular-nums", showClock ? "text-chalk-100" : "text-chalk-500")}>
          {showClock ? countdown.label : "settling…"}
        </p>
        <p className="mt-1 text-xs text-accent">+{potential.toFixed(1)} pts if right</p>
      </div>
    </div>
  );
}

function SettledPositionRow({ pick, settledAt }: { pick: Pick; settledAt: string | null }) {
  const tone = pick.outcome === "correct" ? "gain" : pick.outcome === "incorrect" ? "loss" : "neutral";
  const points = pick.points_awarded ?? 0;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-chalk-800 bg-pitch-950/60 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {marketHref(pick.markets) ? (
            <Link href={marketHref(pick.markets)!} className="truncate font-medium text-chalk-100 hover:text-accent">
              {pick.markets?.underlying ?? "Market"}
            </Link>
          ) : <span className="truncate font-medium text-chalk-100">{pick.markets?.underlying ?? "Market"}</span>}
          <Badge tone={pick.direction === "up" ? "gain" : "loss"}>{pick.direction === "up" ? "CLASH" : "CRASH"}</Badge>
          {pick.is_captain && <Badge tone="accent" dot>Captain</Badge>}
        </div>
        <p className="mt-1 text-xs text-chalk-500">
          Entry {(pick.entry_implied_probability * 100).toFixed(0)}% · ${pick.stake_usd.toFixed(2)}
          {settledAt ? ` · Settled ${fmtDate(settledAt)}` : ""}
        </p>
      </div>
      <div className="text-right">
          <Badge tone={tone}>{pick.outcome ?? "—"}</Badge>
          <p className={cn("mt-1 font-mono text-sm tabular-nums", points > 0 ? "text-gain" : "text-chalk-500")}>
            {points > 0 ? "+" : ""}{points.toFixed(1)} pts
          </p>
          {marketHref(pick.markets) && (
            <Link href={marketHref(pick.markets)!} className="mt-1 block text-[11px] text-accent hover:underline">
              View resolution →
            </Link>
          )}
      </div>
    </div>
  );
}

export function PositionsView() {
  const [squads, setSquads] = useState<Squad[] | null>(null);
  const [trades, setTrades] = useState<SoloTrade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openPage, setOpenPage] = useState(0);
  const [settledPage, setSettledPage] = useState(0);
  const [tradePage, setTradePage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/squads/history", { cache: "no-store" })
        .then((r) => r.json())
        .then((body) => {
          if (cancelled) return;
          if (body.error) setError(body.error);
          else setSquads(body.squads ?? []);
        })
        .catch(() => !cancelled && setError("Could not load your positions"));
      // Solo trades are a best-effort add-on — never let them error out the page.
      fetch("/api/solo-trades", { cache: "no-store" })
        .then((r) => r.json())
        .then((body) => { if (!cancelled) setTrades(body.trades ?? []); })
        .catch(() => undefined);
    };
    load();
    const id = window.setInterval(load, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const { open, settled } = useMemo(() => {
    const openRows: Array<{ pick: Pick; expiresAt: string | null; league: string }> = [];
    const settledRows: Array<{ pick: Pick; league: string; timestamp: string }> = [];
    for (const squad of squads ?? []) {
      for (const pick of squad.picks ?? []) {
        if (pick.outcome === null) openRows.push({ pick, expiresAt: pick.markets?.expires_at ?? null, league: squad.league_type });
        else settledRows.push({ pick, league: squad.league_type, timestamp: squad.submitted_at ?? squad.created_at });
      }
    }
    return { open: openRows, settled: settledRows };
  }, [squads]);

  const openStake = open.reduce((s, r) => s + r.pick.stake_usd, 0);
  const settledPoints = settled.reduce((s, r) => s + (r.pick.points_awarded ?? 0), 0);
  const openPageCount = Math.ceil(open.length / PAGE_SIZE);
  const settledPageCount = Math.ceil(settled.length / PAGE_SIZE);
  const tradePageCount = Math.ceil(trades.length / PAGE_SIZE);
  const visibleOpen = open.slice(Math.min(openPage, Math.max(0, openPageCount - 1)) * PAGE_SIZE, (Math.min(openPage, Math.max(0, openPageCount - 1)) + 1) * PAGE_SIZE);
  const visibleSettled = settled.slice(Math.min(settledPage, Math.max(0, settledPageCount - 1)) * PAGE_SIZE, (Math.min(settledPage, Math.max(0, settledPageCount - 1)) + 1) * PAGE_SIZE);
  const visibleTrades = trades.slice(Math.min(tradePage, Math.max(0, tradePageCount - 1)) * PAGE_SIZE, (Math.min(tradePage, Math.max(0, tradePageCount - 1)) + 1) * PAGE_SIZE);

  if (error) {
    return <EmptyState title="Couldn't load positions" description={error} />;
  }

  if (squads === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (open.length === 0 && settled.length === 0 && trades.length === 0) {
    return (
      <EmptyState
        title="No positions yet"
        description="Build a squad and your open picks will show here — live, with a countdown to settlement."
        action={
          <Link href="/" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast">
            Play a round
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card><CardBody className="py-4"><p className="text-xs uppercase tracking-widest text-chalk-500">Open picks</p><p className="mt-1 font-display text-2xl text-chalk-100 tabular-nums">{open.length}</p></CardBody></Card>
        <Card><CardBody className="py-4"><p className="text-xs uppercase tracking-widest text-chalk-500">At stake</p><p className="mt-1 font-display text-2xl text-chalk-100 tabular-nums">${openStake.toFixed(2)}</p></CardBody></Card>
        <Card><CardBody className="py-4"><p className="text-xs uppercase tracking-widest text-chalk-500">Points banked</p><p className="mt-1 font-display text-2xl text-gain tabular-nums">{settledPoints.toFixed(1)}</p></CardBody></Card>
      </div>

      {open.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-chalk-100">Open positions</h2>
          <p className="text-xs text-chalk-500">Live until their market settles. Points are awarded on settlement.</p>
          <div className="mt-3 space-y-2">
            {visibleOpen.map((row) => (
              <OpenPositionRow key={row.pick.id} pick={row.pick} expiresAt={row.expiresAt} />
            ))}
          </div>
          <PageControls page={Math.min(openPage, Math.max(0, openPageCount - 1))} total={open.length} onChange={setOpenPage} />
        </section>
      )}

      {settled.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-chalk-100">Settled</h2>
          <div className="mt-3 space-y-2">
            {visibleSettled.map((row) => (
              <SettledPositionRow key={row.pick.id} pick={row.pick} settledAt={row.pick.settled_at ?? row.timestamp} />
            ))}
          </div>
          <PageControls page={Math.min(settledPage, Math.max(0, settledPageCount - 1))} total={settled.length} onChange={setSettledPage} />
        </section>
      )}

      {trades.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-chalk-100">Solo trades</h2>
          <p className="text-xs text-chalk-500">Direct bets from the board — real on-chain positions, outside the league game.</p>
          <div className="mt-3 space-y-2">
            {visibleTrades.map((t) => {
              const settledTone = t.outcome === "correct" ? "gain" : t.outcome === "incorrect" ? "loss" : "neutral";
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-chalk-800 bg-pitch-950/60 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-chalk-100">{t.underlying}</span>
                      <Badge tone={t.direction === "up" ? "gain" : "loss"}>{t.direction === "up" ? "CLASH" : "CRASH"}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-chalk-500">
                      {t.entry_implied_probability != null ? `Entry ${(t.entry_implied_probability * 100).toFixed(0)}% · ` : ""}${t.stake_usd.toFixed(2)} · {fmtDate(t.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge tone={t.status === "open" ? "neutral" : settledTone}>{t.status === "open" ? "open" : t.outcome ?? t.status}</Badge>
                    <a
                      href={`${somniaTestnet.blockExplorers.default.url}/tx/${t.onchain_tx_hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block font-mono text-[11px] text-accent hover:underline"
                    >
                      {t.onchain_tx_hash.slice(0, 10)}…
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
          <PageControls page={Math.min(tradePage, Math.max(0, tradePageCount - 1))} total={trades.length} onChange={setTradePage} />
        </section>
      )}

      {(squads ?? []).some((s) => s.picks?.some((p) => p.outcome !== null)) && (
        <section>
          <h2 className="font-display text-lg text-chalk-100">Your settlement cards</h2>
          <p className="text-xs text-chalk-500">Auto-generated PNL cards — share your calls.</p>
          <div className="mt-3 space-y-2">
            {(squads ?? [])
              .filter((s) => s.picks?.some((p) => p.outcome !== null))
              .map((s) => {
                const wins = s.picks.filter((p) => p.outcome === "correct").length;
                const losses = s.picks.filter((p) => p.outcome === "incorrect").length;
                return (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-chalk-800 bg-pitch-950/60 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium capitalize text-chalk-100">
                        {s.league_type} · {s.total_score.toFixed(1)} pts
                      </p>
                      <p className="text-xs text-chalk-500">
                        {wins}W · {losses}L
                      </p>
                    </div>
                    <ShareButtons
                      path={`/matchday-card/${s.id}`}
                      text={`My ${s.league_type} card on Clash Markets — ${s.total_score.toFixed(1)} pts`}
                    />
                  </div>
                );
              })}
          </div>
        </section>
      )}
    </div>
  );
}
