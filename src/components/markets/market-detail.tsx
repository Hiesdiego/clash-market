"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getDreamDexBrowserClient } from "@/lib/dreamdex/browser-client";
import { assetDisplayName, marketPath, MarketCard, type MarketCardView } from "@/components/markets/market-card";
import { arenaMarketMeta } from "@/lib/markets/arena";
import { marketCategory } from "@/lib/markets/category";
import { MarketCardFooter } from "@/components/markets/market-card-footer";
import { ShareButtons } from "@/components/ui/share-buttons";

type ApiMarket = {
  id: string;
  asset: string;
  question: string;
  status: string;
  kind?: "up-down" | "fixed-strike";
  strikePrice?: number | null;
  intervalSec: number;
  openingPrice: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  symbol?: string;
  poolAddress?: string | null;
  quoteDecimals?: number;
  expiresAt?: string | null;
  onchain_market_id?: string;
  resolutionOutcome?: "up" | "down" | null;
};

type Sample = { t: number; mid: number };

function toView(m: ApiMarket): MarketCardView {
  return {
    id: m.id,
    onchainMarketId: m.onchain_market_id ?? m.id,
    asset: m.asset,
    question: m.question,
    kind: m.kind,
    strikePrice: m.strikePrice ?? null,
    windowSeconds: m.intervalSec,
    openingPrice: m.openingPrice,
    spread: m.spread,
    bestBid: m.bestBid,
    bestAsk: m.bestAsk,
    expiresAt: m.expiresAt ?? null,
  };
}

const clampP = (p: number) => Math.min(0.99, Math.max(0.01, p));
const oddsFrom = (p: number) => 1 / clampP(p);

/** Real-time odds-movement line, sampled client-side from the live order book. */
function OddsChart({ series }: { series: Sample[] }) {
  if (series.length === 0) return <div className="flex h-48 items-center justify-center text-sm text-chalk-500">Waiting for the first live quote…</div>;
  const odds = series.map((s) => oddsFrom(s.mid));
  const min = Math.min(...odds);
  const max = Math.max(...odds);
  const range = max - min || 1;
  const W = 600;
  const H = 180;
  const pad = 10;
  const pts = odds
    .map((o, i) => {
      const x = odds.length === 1 ? W / 2 : pad + (i / (odds.length - 1)) * (W - 2 * pad);
      const y = pad + (1 - (o - min) / range) * (H - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${pad},${H - pad} ${pts} ${W - pad},${H - pad}`;
  const latest = pts.split(" ").at(-1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full overflow-visible" preserveAspectRatio="none" aria-label="Odds movement chart">
      <defs>
        <linearGradient id="odds-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity=".28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((line) => <line key={line} x1={pad} x2={W - pad} y1={H * line} y2={H * line} stroke="var(--color-chalk-800)" strokeOpacity=".55" strokeDasharray="4 8" />)}
      <polygon points={area} fill="url(#odds-area)" />
      {odds.length > 1 && <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />}
      {latest && <circle cx={latest.split(",")[0]} cy={latest.split(",")[1]} r="5" fill="var(--accent)" />}
    </svg>
  );
}

export function MarketDetail({ marketId }: { marketId: string }) {
  const [all, setAll] = useState<ApiMarket[] | null>(null);
  const [historical, setHistorical] = useState<ApiMarket | null>(null);
  const [series, setSeries] = useState<Sample[]>([]);
  const symbolRef = useRef<string | null>(null);

  // Meta + similar markets — one shot, served from the cached discovery feed.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/markets/all")
      .then((r) => r.json())
      .then((b) => !cancelled && setAll(b.markets ?? []))
      .catch(() => !cancelled && setAll([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const liveMarket = useMemo(
    () => {
      const requested = marketId.toLowerCase();
      return all?.find((m) => {
        const id = m.id.toLowerCase();
        return id === requested
          || m.onchain_market_id?.toLowerCase() === requested
          || (!requested.startsWith("0x") && requested.endsWith(id.slice(-8)));
      }) ?? null;
    },
    [all, marketId]
  );
  useEffect(() => {
    if (all === null || liveMarket) return;
    let cancelled = false;
    fetch(`/api/markets/${encodeURIComponent(marketId)}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((body) => {
        if (!cancelled && body?.market) setHistorical(body.market as ApiMarket);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [all, liveMarket, marketId]);

  const market = liveMarket ?? historical;
  const similar = useMemo(
    () => (all ?? []).filter((m) => market && m.id !== market.id && m.asset === market.asset).slice(0, 4),
    [all, market]
  );
  const assetName = market ? assetDisplayName(market.asset) : "asset";
  const arena = market ? arenaMarketMeta(market.asset) : null;
  const category = market
    ? marketCategory({ asset: market.asset, openingPrice: market.openingPrice, strikePrice: market.strikePrice, kind: market.kind })
    : "price";
  const usesRealQuestion = category !== "price";
  const detailSubtitle = arena ? arena.label : category === "other" ? "Prediction market" : assetName;
  const detailNote = arena
    ? "The market resolves on the agent's net asset value (NAV) when the session closes."
    : category === "other"
      ? "The market resolves when the window closes."
      : `The market resolves against the ${market?.kind === "fixed-strike" ? "strike" : "opening"} price when the window closes.`;

  // Live odds movement — poll the order book directly (fresher and lighter than
  // re-pulling the whole board) and keep a rolling window of samples.
  useEffect(() => {
    if (!market || market.status !== "trading") return;
    const currentMarket = market;
    let cancelled = false;
    let timer: number | undefined;
    const exchange = getDreamDexBrowserClient();
    const seedSymbol = currentMarket.symbol ?? null;
    symbolRef.current = null;

    async function tick() {
      try {
        let mid: number | undefined;
        if (currentMarket.poolAddress) {
          const quoteDecimals = currentMarket.quoteDecimals ?? 6;
          const book = await exchange.client.getBinaryOrderBook(currentMarket.poolAddress as `0x${string}`, {
            depth: 5,
            decimals: quoteDecimals,
          });
          const ask = book.yesAsks[0]?.price == null ? undefined : Number(book.yesAsks[0].price) / 10 ** quoteDecimals;
          const bid = book.yesBids[0]?.price == null ? undefined : Number(book.yesBids[0].price) / 10 ** quoteDecimals;
          mid = ask !== undefined && bid !== undefined ? (ask + bid) / 2 : ask ?? bid;
        } else {
          if (!symbolRef.current) {
            await exchange.loadMarkets();
            symbolRef.current = seedSymbol ?? exchange.market(currentMarket.id).symbol;
          }
          const book = await exchange.fetchOrderBook(symbolRef.current, 5);
          const ask = book.asks[0]?.[0];
          const bid = book.bids[0]?.[0];
          mid = ask !== undefined && bid !== undefined ? (ask + bid) / 2 : ask ?? bid;
        }
        if (mid != null && Number.isFinite(mid) && !cancelled) setSeries((s) => [...s.slice(-59), { t: Date.now(), mid }]);
      } catch {
        // Transient book errors are fine; the next tick retries.
      }
      if (!cancelled) timer = window.setTimeout(tick, 4000);
    }
    tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [market]);

  if (all === null) {
    return <div className="h-96 animate-pulse rounded-2xl bg-pitch-900" />;
  }
  if (!market) {
    return (
      <div className="rounded-2xl border border-dashed border-chalk-700 p-12 text-center text-chalk-500">
        <p>This market isn&apos;t live right now.</p>
        <Link href="/" className="mt-3 inline-block text-sm font-semibold text-accent hover:brightness-110">
          ← Back to the board
        </Link>
      </div>
    );
  }

  const latest = series[series.length - 1]?.mid ?? (market.bestBid != null && market.bestAsk != null ? (market.bestBid + market.bestAsk) / 2 : null);
  const upOdds = latest != null ? oddsFrom(latest) : null;
  const downOdds = latest != null ? oddsFrom(1 - latest) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="text-sm text-chalk-500 transition-colors hover:text-chalk-300">
          ← All markets
        </Link>
        <ShareButtons path={marketPath(toView(market))} text={usesRealQuestion ? `${market.question} — trade it on Clash Markets` : `${assetName} price direction — trade it on Clash Markets`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_.9fr] lg:items-start">
        {/* Live chart + book */}
        <section className="rounded-2xl border border-chalk-800 bg-pitch-900/90 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold leading-snug text-chalk-100">{usesRealQuestion ? market.question : `Will ${assetName} finish higher at expiry?`}</h1>
              <p className="mt-1 text-xs uppercase tracking-widest text-chalk-500">Odds movement · {detailSubtitle}</p>
              <p className="mt-2 max-w-lg text-xs text-chalk-500">{detailNote}</p>
            </div>
            {market.status === "trading" ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gain">
                <span className="h-2 w-2 animate-pulse rounded-full bg-gain shadow-[0_0_10px] shadow-gain" />
                Tracking
              </span>
            ) : (
              <span className="text-xs font-semibold uppercase tracking-widest text-accent">Final result</span>
            )}
          </div>

          {market.status === "resolved" && market.resolutionOutcome && (
            <div className="mt-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-chalk-100">
              Resolved <span className={market.resolutionOutcome === "up" ? "font-bold text-gain" : "font-bold text-loss"}>
                {market.resolutionOutcome === "up" ? "CLASH" : "CRASH"}
              </span>
              {market.expiresAt ? ` at ${new Date(market.expiresAt).toLocaleString()}` : ""}.
            </div>
          )}

          <div className="mt-4">
            <OddsChart series={series} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-chalk-950 p-3">
              <p className="text-xs text-chalk-500">CLASH · decimal odds</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-gain">{upOdds != null ? upOdds.toFixed(2) : "—"}</p>
            </div>
            <div className="rounded-xl bg-chalk-950 p-3">
              <p className="text-xs text-chalk-500">CRASH · decimal odds</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-loss">{downOdds != null ? downOdds.toFixed(2) : "—"}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-chalk-500">
            Odds move in real time with the order book — {latest != null ? `Up is trading at ${(clampP(latest) * 100).toFixed(0)}% implied` : "waiting for the first quote"}.
          </p>
        </section>

        {/* Tradeable card */}
        <div>
            <MarketCard
              view={toView(market)}
              live={market.status === "trading"}
              footer={market.status === "trading" ? <MarketCardFooter mode="trade" market={toView(market)} /> : undefined}
            />
        </div>
      </div>

      {similar.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-chalk-100">Similar markets</h2>
          <p className="text-xs text-chalk-500">More {market.asset} markets you can trade right now.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {similar.map((m) => (
              <MarketCard key={m.id} view={toView(m)} href={marketPath(toView(m))} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
