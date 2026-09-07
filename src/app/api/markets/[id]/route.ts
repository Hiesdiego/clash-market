import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ORACLE_PRICE_DECIMALS } from "@/lib/dreamdex/opening-price";
import { marketCategory } from "@/lib/markets/category";

type MarketRow = {
  id: string;
  onchain_market_id: string;
  underlying: string;
  window_length_seconds: number;
  expires_at: string;
  status: string;
  resolution_outcome: "up" | "down" | null;
  raw_snapshot: Record<string, unknown> | null;
  best_bid: number | null;
  best_ask: number | null;
  spread: number | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function toDiscoveryMarket(market: MarketRow) {
  const snapshot = market.raw_snapshot ?? {};
  const info = asRecord(snapshot.info);
  const rawQuestion = typeof info.question === "string" ? info.question.trim() : "";
  const openingPrice = typeof snapshot.clashOpeningPrice === "number" && Number.isFinite(snapshot.clashOpeningPrice)
    ? snapshot.clashOpeningPrice
    : null;
  const strikeNumeric = Number(info.strike ?? snapshot.strike);
  const strikePrice = openingPrice == null && Number.isFinite(strikeNumeric) && strikeNumeric > 0
    ? strikeNumeric / 10 ** ORACLE_PRICE_DECIMALS
    : null;
  const kind = strikePrice != null ? "fixed-strike" : "up-down";
  const category = marketCategory({ asset: market.underlying, openingPrice, strikePrice, kind });
  const question = category === "price"
    ? (kind === "fixed-strike" && rawQuestion ? rawQuestion : `${market.underlying} — up or down by expiry?`)
    : rawQuestion || `${market.underlying} — up or down by expiry?`;
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
    resolutionOutcome: market.resolution_outcome,
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
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requested = decodeURIComponent(id).toLowerCase();
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("markets").select("*").eq("onchain_market_id", requested).maybeSingle();
  let { data, error } = await query;

  // Position links use the same readable suffix slug as the live cards. A
  // suffix lookup lets historical links work without exposing a UUID in the UI.
  if (!data && !error && !requested.startsWith("0x")) {
    const suffix = requested.replace(/[^a-f0-9]/g, "").slice(-8);
    if (suffix.length === 8) {
      ({ data, error } = await supabase.from("markets").select("*").ilike("onchain_market_id", `%${suffix}`).maybeSingle());
    }
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Market not found" }, { status: 404 });
  return NextResponse.json({ market: toDiscoveryMarket(data as MarketRow) });
}
