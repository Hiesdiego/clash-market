import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ORACLE_PRICE_DECIMALS } from "@/lib/dreamdex/opening-price";

export const dynamic = "force-dynamic";

type MarketRow = {
  id: string;
  onchain_market_id: string;
  underlying: string;
  window_length_seconds: number;
  expires_at: string;
  status: string;
  raw_snapshot: Record<string, unknown> | null;
  best_bid: number | null;
  best_ask: number | null;
  spread: number | null;
};

type DiscoveryMarket = {
  id: string;
  asset: string;
  intervalSec: number;
  marketType: string;
  kind: "up-down" | "fixed-strike";
  strikePrice: number | null;
  question: string;
  status: string;
  referencePrice: number | null;
  openingPrice: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  spread: number | null;
  symbol: string | null;
  poolAddress: string | null;
  quoteDecimals: number;
  expiresAt: string;
  onchainMarketId: string;
  onchain_market_id: string;
  underlying: string;
  window_length_seconds: number;
  best_bid: number | null;
  best_ask: number | null;
  expires_at: string;
  raw: Record<string, unknown>;
};

let snapshot: { at: number; markets: DiscoveryMarket[] } | null = null;
let inflight: Promise<DiscoveryMarket[]> | null = null;
const TTL_MS = 8_000;
const SUPABASE_PAGE_SIZE = 1000;

async function buildFeed(): Promise<DiscoveryMarket[]> {
  const supabase = await createSupabaseServerClient();
  const expiresAfter = new Date().toISOString();
  const rows: MarketRow[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("markets")
      .select("*")
      .eq("status", "trading")
      .gt("expires_at", expiresAfter)
      .order("featured", { ascending: false })
      .order("expires_at", { ascending: true })
      .range(from, from + SUPABASE_PAGE_SIZE - 1);

    if (error) throw error;
    rows.push(...((data ?? []) as MarketRow[]));
    if (!data || data.length < SUPABASE_PAGE_SIZE) break;
  }

  return rows.map((market) => {

    const snapshot = market.raw_snapshot ?? {};
    const info = (snapshot.info ?? {}) as Record<string, unknown>;
    const rawQuestion = typeof info.question === "string" ? info.question.trim() : "";
    const openingPrice = typeof snapshot.clashOpeningPrice === "number"
      && Number.isFinite(snapshot.clashOpeningPrice)
      ? snapshot.clashOpeningPrice
      : null;
    const strikeNumeric = Number(info.strike ?? snapshot.strike);
    const strikePrice = openingPrice == null && Number.isFinite(strikeNumeric) && strikeNumeric > 0
      ? strikeNumeric / 10 ** ORACLE_PRICE_DECIMALS
      : null;
    const kind: DiscoveryMarket["kind"] = strikePrice != null ? "fixed-strike" : "up-down";
    const question = kind === "fixed-strike" && rawQuestion
      ? rawQuestion
      : `${market.underlying} — up or down by expiry?`;
    const symbol = typeof snapshot.symbol === "string" ? snapshot.symbol : null;
    const poolAddress = typeof snapshot.poolAddress === "string"
      ? snapshot.poolAddress
      : typeof info.poolAddress === "string" ? info.poolAddress : null;
    const parsedQuoteDecimals = Number(snapshot.quoteDecimals ?? info.quoteDecimals);
    const quoteDecimals = Number.isInteger(parsedQuoteDecimals) && parsedQuoteDecimals >= 0 ? parsedQuoteDecimals : 6;

    return {
      id: market.onchain_market_id,
      asset: market.underlying,
      intervalSec: market.window_length_seconds,
      marketType: "BINARY",
      kind,
      strikePrice,
      question,
      status: market.status,
      referencePrice: strikePrice ?? openingPrice,
      openingPrice,
      bestBid: market.best_bid,
      bestAsk: market.best_ask,
      spread: market.spread,
      symbol,
      poolAddress,
      quoteDecimals,
      expiresAt: market.expires_at,
      onchainMarketId: market.onchain_market_id,
      onchain_market_id: market.onchain_market_id,
      underlying: market.underlying,
      window_length_seconds: market.window_length_seconds,
      best_bid: market.best_bid,
      best_ask: market.best_ask,
      expires_at: market.expires_at,
      raw: snapshot,
    };
  });
}

export async function GET() {
  try {
    const now = Date.now();
    if (snapshot && now - snapshot.at < TTL_MS) {
      return NextResponse.json({ markets: snapshot.markets, cached: true });
    }
    if (!inflight) {
      inflight = buildFeed()
        .then((markets) => {
          snapshot = { at: Date.now(), markets };
          return markets;
        })
        .finally(() => {
          inflight = null;
        });
    }
    return NextResponse.json({ markets: await inflight });
  } catch (error) {
    if (snapshot) return NextResponse.json({ markets: snapshot.markets, stale: true });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load markets" },
      { status: 500 },
    );
  }
}
