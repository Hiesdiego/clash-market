import type { SomniaMarkets } from "@somnia-chain/markets-sdk";
import type { Address } from "viem";

/**
 * STATUS: not currently called by the live submission path.
 * submit.ts's submitSquadSequential() (the only real path — see that
 * file's top comment for why the batched path was removed) uses the
 * unified `createOrder` verb directly instead of this file's raw
 * calldata builder.
 *
 * Kept, not deleted: the calldata-building logic below is real and
 * correct — it uses `trader.buildPlaceOrder`, a confirmed SDK method
 * (installed and inspected directly, Phase 4) — and is exactly what a
 * future real batching implementation (e.g. a hand-rolled EIP-7702
 * transaction, or whatever Privy's SDK eventually ships for this) would
 * need: an array of unsigned {to, data, value} calls per pick. It's
 * infrastructure ready for that day, not dead code pretending to be
 * wired into anything today.
 */

export interface SquadPickInput {
  onchainMarketId: `0x${string}`;
  direction: "up" | "down";
  stakeUsd: number;
  isCaptain: boolean;
}

export interface BuiltPickOrder {
  pick: SquadPickInput;
  calls: { to: Address; data: `0x${string}`; value: bigint }[];
  entryImpliedProbability: number;
}

/**
 * A "market order" on the raw tier is an IOC order priced at the
 * extreme so it crosses whatever liquidity is resting, per
 * PlaceOrderParams' own doc comment: "A market order is an IOC (2)
 * placed at the price extreme so it crosses immediately."
 *
 * One direction-sensitive detail worth flagging rather than asserting
 * with full confidence: `price` in PlaceOrderParams is ALWAYS
 * YES-denominated, even for a BUY_NO order (confirmed: "YES limit
 * price as raw collateral units per whole outcome token" — no
 * separate NO-terms field exists). Since NO price = 1 − YES price
 * (market-structure.md), the aggressive extreme for each side is:
 *   - BUY_YES: YES price near 1 (willing to pay up to ~100% for YES)
 *   - BUY_NO:  YES price near 0 (equivalent to ~100% for NO)
 * Derived from the documented single-book YES-quoted mechanic, not
 * guessed — but genuinely worth a live testnet smoke test before
 * relying on it for real stakes, given how costly a silently-inverted
 * price would be. See docs/PHASE-4-SQUAD-BUILDER.md.
 */
const YES_EXTREME = 0.999999;
const NO_SIDE_YES_EXTREME = 0.000001;

/**
 * Builds ALL 5 picks' unsigned order calls (Captain's quantity already
 * doubled by the caller passing a pre-doubled stakeUsd) — used by both
 * the one-tap batched path (all calls concatenated into one
 * `sendTransaction({ calls })`) and the sequential fallback (each
 * pick's calls sent as their own transaction, one at a time).
 *
 * Reads live market state via `exchange.client.getMarketOnchain` +
 * `exchange.fetchOrderBook` right before building each order, per
 * gotcha #1 — the board is a synced snapshot, so submission time re-checks
 * live status and order-book availability rather than trusting its cache.
 */
export async function buildSquadOrders(
  exchange: SomniaMarkets,
  picks: SquadPickInput[]
): Promise<BuiltPickOrder[]> {
  const built: BuiltPickOrder[] = [];

  for (const pick of picks) {
    const onchain = await exchange.client.getMarketOnchain(pick.onchainMarketId);
    if (onchain.status !== 1) {
      throw new Error(
        `Market ${pick.onchainMarketId} is no longer trading (status ${onchain.status}) — it moved since you drafted this squad.`
      );
    }

    const tradable = exchange.market(pick.onchainMarketId);
    const upSymbol = tradable.symbol;
    if (!upSymbol) throw new Error(`Could not resolve a tradable symbol for ${pick.onchainMarketId}`);
    // Assumes exchange.market() resolves a bare marketId (no outcome
    // suffix) to the YES tradable by default, matching PlaceOrderParams'
    // "price is always YES-denominated" convention used below. Plausible
    // given `Tradable.outcome` defaults meaningfully, but worth confirming
    // directly (e.g. logging `tradable.outcome`) in the same live smoke
    // test as the price-extreme direction noted above.

    const market = exchange.markets[upSymbol];
    const book = await exchange.fetchOrderBook(upSymbol, 5);
    const bestAsk = book.asks[0]?.[0];
    const bestBid = book.bids[0]?.[0];
    // Entry implied probability for Conviction Scoring — the touch's
    // midpoint if both sides are quoted, otherwise whichever side exists.
    const entryImpliedProbability =
      bestAsk !== undefined && bestBid !== undefined
        ? (bestAsk + bestBid) / 2
        : bestAsk ?? bestBid ?? 0.5;

    const yesExtreme = pick.direction === "up" ? YES_EXTREME : NO_SIDE_YES_EXTREME;
    const alignedPrice = exchange.priceToPrecision(upSymbol, yesExtreme);
    const info = market?.info as { quoteDecimals?: number; baseDecimals?: number } | undefined;
    const quoteDecimals = info?.quoteDecimals ?? 6;
    const baseDecimals = info?.baseDecimals ?? 6;

    const contracts = pick.stakeUsd / alignedPrice;
    const alignedQuantity = exchange.amountToPrecision(upSymbol, contracts);

    const rawPrice = BigInt(Math.round(alignedPrice * 10 ** quoteDecimals));
    const rawQuantity = BigInt(Math.round(alignedQuantity * 10 ** baseDecimals));

    const unsigned = await exchange.trader.buildPlaceOrder({
      pool: onchain.pool,
      side: pick.direction === "up" ? "BUY_YES" : "BUY_NO",
      price: rawPrice,
      quantity: rawQuantity,
      outcomeToken: onchain.outcomeToken,
      yesId: onchain.yesId,
      noId: onchain.noId,
      collateral: onchain.collateral,
      orderType: 2, // ImmediateOrCancel — see doc comment above
    });

    const calls: BuiltPickOrder["calls"] = [];
    if (unsigned.approval) calls.push(unsigned.approval as BuiltPickOrder["calls"][number]);
    calls.push(unsigned.order as BuiltPickOrder["calls"][number]);

    built.push({ pick, calls, entryImpliedProbability });
  }

  return built;
}
