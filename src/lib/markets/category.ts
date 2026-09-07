import { isArenaMarket } from "./arena";

export type MarketCategory = "price" | "arena" | "other";

const PRICE_ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE"];

export interface MarketCategoryInput {
  asset: string | null | undefined;
  openingPrice?: number | null;
  strikePrice?: number | null;
  kind?: "up-down" | "fixed-strike" | null;
}

function isKnownPriceAsset(asset: string | null | undefined): boolean {
  if (!asset) return false;
  const normalized = asset.trim().toUpperCase();
  return PRICE_ASSETS.some((symbol) => normalized.includes(symbol));
}

export function marketCategory(input: MarketCategoryInput): MarketCategory {
  if (isArenaMarket(input.asset)) return "arena";
  const hasStrike = input.kind === "fixed-strike"
    || (input.strikePrice != null && Number.isFinite(input.strikePrice) && input.strikePrice > 0);
  const hasOpening = input.openingPrice != null && Number.isFinite(input.openingPrice);
  if (hasStrike || hasOpening || isKnownPriceAsset(input.asset)) return "price";
  return "other";
}
