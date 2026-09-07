/**
 * Shared reader for `SomniaMarkets.client.getOpeningPrices()`.
 *
 * IMPORTANT (was a real bug): `getOpeningPrices(marketIds)` returns a
 * `Record<string, string | null>` keyed by **lowercased marketId** → the raw
 * oracle `numericValue` (an int256 as a decimal string, or `null` when the
 * reference question has no answer yet). The previous callers indexed it as
 * `opening[0]?.openingAnswer?.numericValue`, i.e. treated it as an array of
 * `{ openingAnswer: { numericValue } }` objects. That shape does not exist, so
 * `opening[0]` was always `undefined` and the opening price was ALWAYS null —
 * every market card showed "Not available".
 *
 * The value is the market's OPENING / call price — the line the underlying must
 * beat at settlement ("closes at or above its opening price"). It is scaled by
 * the oracle's price decimals. Confirmed empirically against live testnet feeds:
 * DreamDEX scales prices by 10^2 (2 decimals), NOT the 8-decimal convention this
 * originally assumed — at 8 decimals BTC (~$78k) rendered as 0.078 and ETH-tier
 * (~$2k) as 0.002, i.e. off by exactly 10^6 (= 10^(8-2)). If a feed ever uses a
 * different scale, the number will be off by a power of ten — adjust
 * ORACLE_PRICE_DECIMALS here (single source).
 */
export const ORACLE_PRICE_DECIMALS = 2;

// Most DreamDEX reference answers in the current feed use the legacy 2-digit
// price scale. A small set of long-dated markets was created with the
// 8-decimal oracle scale, however. Their raw answer is otherwise identical
// in meaning, so dividing every answer by 1e2 turns e.g. 245058000000 into
// $2,450,580,000 instead of $2,450.58.
const LEGACY_ORACLE_PRICE_DECIMALS = 2;
const LONG_ORACLE_PRICE_DECIMALS = 8;
const MAX_REASONABLE_REFERENCE_PRICE = 100_000_000;

export function parseOpeningPrice(
  openingPrices: Record<string, string | null>,
  marketId: string
): number | null {
  const raw = openingPrices[marketId.toLowerCase()];
  if (raw == null) return null;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return null;

  const legacyValue = numeric / 10 ** LEGACY_ORACLE_PRICE_DECIMALS;
  // Prefer the established scale. Only fall back when it produces an
  // impossible-sized crypto reference price; this keeps normal 2-decimal
  // answers unchanged while correcting the 8-decimal long-dated feed.
  if (Math.abs(legacyValue) <= MAX_REASONABLE_REFERENCE_PRICE) return legacyValue;
  return numeric / 10 ** LONG_ORACLE_PRICE_DECIMALS;
}
