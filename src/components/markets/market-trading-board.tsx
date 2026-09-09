"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { getDreamDexBrowserClient, bindSigner } from "@/lib/dreamdex/browser-client";
import { createPrivyWalletClient } from "@/lib/privy/browser-wallet";
import { submitSquadSequential } from "@/lib/squad-builder/submit";
import { projectPayout } from "@/lib/squad-builder/pricing";
import { marketPath, MarketCard, type MarketCardView } from "@/components/markets/market-card";
import { MarketCardFooter } from "@/components/markets/market-card-footer";
import Link from "next/link";
import { LEAGUE_CONFIG, type LeagueType } from "@/lib/constants/leagues";
import { useAuth } from "@/components/providers/auth-provider";
import { ShareButtons } from "@/components/ui/share-buttons";

type Market = { id: string; asset: string; intervalSec: number; marketType: string; question: string; status: string; symbol?: string; kind?: "up-down" | "fixed-strike"; strikePrice?: number | null; referencePrice?: number | string | null; openingPrice?: number | null; expiresAt?: string | null; bestBid?: number | null; bestAsk?: number | null; spread?: number | null; onchainMarketId?: string };
type Direction = "up" | "down";

const MIN_STAKE_USD = 0.1;

function toView(market: Market): MarketCardView {
  const opening = market.openingPrice ?? (market.referencePrice != null ? Number(market.referencePrice) : null);
  return {
    id: market.id,
    onchainMarketId: market.onchainMarketId ?? market.id,
    asset: market.asset,
    question: market.question,
    kind: market.kind,
    strikePrice: market.strikePrice ?? null,
    windowSeconds: market.intervalSec,
    openingPrice: opening != null && Number.isFinite(Number(opening)) ? Number(opening) : null,
    spread: market.spread,
    bestBid: market.bestBid,
    bestAsk: market.bestAsk,
    expiresAt: market.expiresAt ?? null,
  };
}

/**
 * Home single-trade actions: a stake input (any amount ≥ $0.10, per the
 * dynamic-stakes requirement), a projected-winnings preview, and the two
 * bet buttons. The discovery feed (/api/markets/all) doesn't carry order-book
 * data, so the implied odds behind the preview are fetched once — lazily, when
 * the player first engages this card — rather than for every card on every poll.
 */
function MarketCardActions({ market }: { market: Market }) {
  const { authenticated, wallet, walletReady, login } = useAuth();
  const [stake, setStake] = useState("1");
  const [pending, setPending] = useState<Direction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [upProbability, setUpProbability] = useState<number | null>(null);
  const [probeTried, setProbeTried] = useState(false);

  const stakeUsd = Number(stake);
  const stakeValid = Number.isFinite(stakeUsd) && stakeUsd >= MIN_STAKE_USD;

  async function probeOdds() {
    if (probeTried) return;
    setProbeTried(true);
    try {
      const exchange = getDreamDexBrowserClient();
      await exchange.loadMarkets();
      const tradable = exchange.market(market.id);
      const book = await exchange.fetchOrderBook(tradable.symbol, 5);
      const bestAsk = book.asks[0]?.[0];
      const bestBid = book.bids[0]?.[0];
      const mid = bestAsk !== undefined && bestBid !== undefined ? (bestAsk + bestBid) / 2 : bestAsk ?? bestBid ?? null;
      if (mid != null) setUpProbability(mid);
    } catch {
      // Odds preview is best-effort; the trade itself re-derives price at submit.
    }
  }

  async function placeBet(direction: Direction) {
    setMessage(null);
    if (!authenticated) { login(); return; }
    if (!walletReady) { setMessage("Your wallet is still loading. Try again in a moment."); return; }
    if (!stakeValid) { setMessage(`Enter a stake of at least $${MIN_STAKE_USD.toFixed(2)}`); return; }
    if (!wallet) { setMessage("Connect a wallet first"); return; }
    setPending(direction);
    try {
      const { walletClient } = await createPrivyWalletClient(wallet);
      bindSigner(walletClient);
      const receipt = await submitSquadSequential(getDreamDexBrowserClient(), [{ onchainMarketId: market.id as `0x${string}`, direction, isCaptain: false, stakeUsd: stakeUsd }]);
      const settledReceipt = receipt[0];
      try {
        await fetch("/api/solo-trades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            onchainMarketId: market.onchainMarketId ?? market.id,
            underlying: market.asset,
            question: market.question,
            direction,
            stakeUsd,
            entryImpliedProbability: settledReceipt?.entryImpliedProbability ?? null,
            onchainTxHash: settledReceipt?.transactionHash ?? null,
          }),
        });
      } catch {
        // The on-chain trade succeeded; recording remains best-effort.
      }
      setMessage(receipt[0] ? `Trade placed · ${receipt[0].transactionHash.slice(0, 8)}…` : "Trade placed");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Trade could not be placed");
    } finally { setPending(null); }
  }

  const preview = stakeValid && upProbability != null
    ? { up: projectPayout(stakeUsd, upProbability).payout, down: projectPayout(stakeUsd, 1 - upProbability).payout }
    : null;

  return (
    <div className="mt-auto">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-chalk-500">$</span>
          <input
            type="number"
            inputMode="decimal"
            min={MIN_STAKE_USD}
            step="0.1"
            value={stake}
            onFocus={probeOdds}
            onChange={(event) => setStake(event.target.value)}
            className="w-full rounded-lg border border-chalk-700 bg-pitch-950 py-2 pl-6 pr-3 text-sm text-chalk-100 outline-none focus:border-classic"
            aria-label="Stake in USD"
          />
        </div>
        <span className="text-xs text-chalk-600">stake</span>
      </div>

      {preview && (
        <p className="mt-2 text-center text-[11px] text-chalk-500">
          If right — <span className="font-semibold text-gain">CLASH ${preview.up.toFixed(2)}</span> ·{" "}
          <span className="font-semibold text-loss">CRASH ${preview.down.toFixed(2)}</span>
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => placeBet("up")} disabled={pending !== null} className="flex items-center justify-center gap-2 rounded-lg bg-gain px-3 py-2 text-sm font-bold text-pitch-950 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-50">
          {pending === "up" ? "Placing…" : <><span>CLASH</span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5m0 0-6 6m6-6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg></>}
        </button>
        <button type="button" onClick={() => placeBet("down")} disabled={pending !== null} className="flex items-center justify-center gap-2 rounded-lg bg-loss px-3 py-2 text-sm font-bold text-chalk-100 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-50">
          {pending === "down" ? "Placing…" : <><span>CRASH</span><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14m0 0 6-6m-6 6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg></>}
        </button>
      </div>

      <p className="mt-2 text-center text-[11px] text-chalk-600">{message ?? "Single trade · winner takes the market"}</p>
    </div>
  );
}

type StandingRow = { rank: number; cumulative_score: number; rounds_played: number; display_name: string | null; wallet_address: string };
const LEADERBOARD_LEAGUES: LeagueType[] = ["blitz", "classic", "horizon"];
const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/**
 * Replaces the old marketing hero ("Trade your read / Own the outcome" + the
 * "Market pulse" stat box). The board now opens on real results: a live top-4
 * league table with per-league tabs, backed by /api/leagues/[league]/standings.
 */
function LeaderboardStrip() {
  const [league, setLeague] = useState<LeagueType>("classic");
  const [rows, setRows] = useState<StandingRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    fetch(`/api/leagues/${league}/standings`, { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => { if (!cancelled) setRows((b.standings ?? []).slice(0, 4)); })
      .catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, [league]);

  return (
    <section className="rounded-2xl border border-chalk-800 bg-pitch-900/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">Top of the table</p>
          <h1 className="mt-1 font-display text-2xl text-chalk-100 sm:text-3xl">Who&apos;s leading right now</h1>
        </div>
        <div className="flex gap-1.5">
          {LEADERBOARD_LEAGUES.map((l) => (
            <button
              key={l}
              onClick={() => setLeague(l)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${league === l ? "bg-chalk-100 text-pitch-950" : "border border-chalk-700 text-chalk-400 hover:border-chalk-400"}`}
            >
              {LEAGUE_CONFIG[l].label}
            </button>
          ))}
        </div>
      </div>

      {rows === null ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-pitch-950" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-chalk-700 p-8 text-center text-sm text-chalk-500">
          No scored rounds in {LEAGUE_CONFIG[league].label} yet — be the first name on the board.
        </p>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((row) => (
            <div key={row.wallet_address} className={`rounded-xl border p-4 ${row.rank === 1 ? "border-accent/40 bg-accent/5" : "border-chalk-800 bg-pitch-950/50"}`}>
              <div className="flex items-center justify-between">
                <span className="text-lg leading-none">{MEDALS[row.rank] ?? <span className="font-mono text-sm text-chalk-500">#{row.rank}</span>}</span>
                <span className="font-display text-xl tabular-nums text-accent">{row.cumulative_score.toFixed(1)}</span>
              </div>
              <p className="mt-3 truncate text-sm font-medium text-chalk-100">
                {row.display_name ?? `${row.wallet_address.slice(0, 6)}…${row.wallet_address.slice(-4)}`}
              </p>
              <p className="text-xs text-chalk-500">{row.rounds_played} rounds played</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-chalk-500">Live standings across every Clash league.</p>
        <Link href="/leagues" className="text-xs font-semibold text-accent hover:brightness-110">Full table →</Link>
      </div>
    </section>
  );
}

type DailyWinner = {
  rank: number;
  points: number;
  correctPredictions: number;
  bestStreak: number;
  displayName: string | null;
  walletAddress: string;
};

function DailyMomentumHero() {
  const [streak, setStreak] = useState(0);
  const [winners, setWinners] = useState<DailyWinner[]>([]);
  const [date, setDate] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      Promise.all([
        fetch("/api/prediction-streak", { cache: "no-store" }).then((response) => response.json()),
        fetch("/api/daily-winners", { cache: "no-store" }).then((response) => response.json()),
      ]).then(([streakBody, winnerBody]) => {
        if (cancelled) return;
        setStreak(Number(streakBody.streak ?? 0));
        setWinners(winnerBody.winners ?? []);
        setDate(winnerBody.date ?? "");
      }).catch(() => undefined);
    };
    load();
    const refresh = window.setInterval(load, 5000);
    return () => { cancelled = true; window.clearInterval(refresh); };
  }, []);

  const streakMultiplier = streak >= 20 ? 5 : streak >= 10 ? 3 : streak >= 3 ? 2 : 1;
  const labelFor = (winner: DailyWinner) => winner.displayName ?? `${winner.walletAddress.slice(0, 6)}…${winner.walletAddress.slice(-4)}`;

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 via-pitch-900/80 to-pitch-950 p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <motion.div
            className="text-5xl drop-shadow-[0_0_18px_rgba(255,210,63,0.65)]"
            animate={{ scale: [1, 1.14, 1], rotate: [-3, 3, -3] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            aria-label={`${streak} prediction streak`}
          >
            🔥
          </motion.div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">Your prediction streak</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-4xl text-chalk-100">{streak}</span>
              <span className="text-sm text-chalk-400">correct calls</span>
              {streakMultiplier > 1 && <span className="rounded-full bg-accent/15 px-2 py-1 text-xs font-bold text-accent">{streakMultiplier}× points</span>}
            </div>
            <p className="mt-1 text-xs text-chalk-500">One wrong call resets the fire.</p>
          </div>
        </div>

        <div className="min-w-0 lg:w-[52%]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gain">Spotlight</p>
              <p className="mt-1 text-xs text-chalk-500">Top three · 00:00–23:00 UTC+1{date && ` · ${date}`}</p>
            </div>
            <span className="text-xs text-chalk-600">Public podium</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[1, 2, 3].map((rank) => {
              const winner = winners.find((candidate) => candidate.rank === rank);
              return (
                <div key={rank} className={`rounded-xl border p-3 ${rank === 1 ? "border-accent/50 bg-accent/10" : "border-chalk-800 bg-pitch-950/60"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}</span>
                    <span className="font-mono text-sm font-bold tabular-nums text-gain">{winner ? `${winner.points.toFixed(0)} pts` : "—"}</span>
                  </div>
                  <p className="mt-2 truncate text-xs font-semibold text-chalk-200">{winner ? labelFor(winner) : "Open spot"}</p>
                  {winner && <ShareButtons path={`/daily-winner-card/${date}/${rank}`} text={`I made today's Clash Spotlight at #${rank} 🔥`} className="mt-2" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function MarketTradingBoard() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Warm the browser exchange registry while the board is rendering. The
    // direct trade path reuses this cache, so the first stake does not have to
    // wait for the full SDK registry scan. This is intentionally limited to
    // the all-markets board; squad submission keeps its own refresh policy.
    void getDreamDexBrowserClient().loadMarkets().catch(() => undefined);
    const load = () => fetch("/api/markets/all", { cache: "no-store" }).then((response) => response.json()).then((body) => { if (!cancelled) setMarkets(body.markets ?? []); }).catch(() => undefined).finally(() => { if (!cancelled) setLoading(false); });
    load(); const id = window.setInterval(load, 10000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  const categories = ["All", "Trending", "New"];
  const visible = useMemo(() => markets.filter((market, index) => { const matchesView = filter === "All" || (filter === "Trending" && index < 6) || (filter === "New" && index >= Math.max(0, markets.length - 6)) || market.marketType === filter; return matchesView && `${market.asset} ${market.question}`.toLowerCase().includes(query.toLowerCase()); }), [filter, markets, query]);

  return <main className="min-h-screen">
    <div className="mx-auto max-w-7xl px-5 pb-16 pt-10 lg:px-8"><LeaderboardStrip /><DailyMomentumHero />
      <section className="mt-14">
        <div className="flex flex-col justify-between gap-4 border-b border-chalk-800 pb-4 sm:flex-row sm:items-center">
          <div><p className="text-xs uppercase tracking-[0.2em] text-chalk-500">Explore the board</p><h2 className="mt-1 font-display text-2xl text-chalk-100">Markets in motion</h2></div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search markets" className="rounded-lg border border-chalk-700 bg-pitch-900 px-4 py-2.5 text-sm text-chalk-100 outline-none placeholder:text-chalk-600 focus:border-classic" />
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">{categories.map((category) => <button key={category} onClick={() => setFilter(category)} className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold ${filter === category ? "bg-chalk-100 text-pitch-950" : "border border-chalk-700 text-chalk-400 hover:border-chalk-400"}`}>{category === "All" ? `All · ${markets.length}` : category}</button>)}</div>
        {loading ? <div className="mt-8 grid gap-3 sm:grid-cols-2"><div className="h-64 animate-pulse rounded-2xl bg-pitch-900" /><div className="h-64 animate-pulse rounded-2xl bg-pitch-900" /></div> : visible.length === 0 ? <p className="mt-10 rounded-xl border border-dashed border-chalk-700 p-10 text-center text-chalk-500">No live markets match that search.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{visible.map((market) => { const view = toView(market); return <MarketCard key={market.id} view={view} href={marketPath(view)} footer={<MarketCardFooter mode="trade" market={view} />} />; })}</div>}
      </section>
    </div>
  </main>;
}
