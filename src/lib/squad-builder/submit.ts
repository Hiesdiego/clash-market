import type { SomniaMarkets } from "@somnia-chain/markets-sdk";
import type { SquadPickInput } from "@/lib/squad-builder/order-building";

export interface SubmissionReceipt {
  pick: SquadPickInput;
  entryImpliedProbability: number;
  transactionHash: `0x${string}`;
}

/**
 * Optional execution hints for callers that already have a fresh market/book
 * snapshot. The default keeps the existing squad-builder safety behaviour.
 */
export interface SubmissionOptions {
  /** Force a full registry refresh before submitting (the squad default). */
  refreshMarkets?: boolean;
  /** Use the caller's book snapshot for the IOC crossing price. */
  reuseOrderBook?: boolean;
}

/**
 * CORRECTION (closing a gap, not just re-flagging it): the previous
 * version of this file had a `submitSquadBatched()` calling
 * `useSmartWallets().client.sendTransaction({ calls })`. Installing
 * `@privy-io/react-auth` directly and inspecting its real shipped
 * types (same discipline as every other SDK check in this build)
 * found that neither `useSmartWallets` NOR any `./smart-wallets`
 * subpath exist anywhere in the package. `useSendTransaction`'s
 * `UnsignedTransactionRequest` type is single-transaction only — no
 * `calls` array field. The web docs this was originally built against
 * describe an API surface that isn't what's actually published in
 * this SDK version.
 *
 * The one real lead investigated: `useSign7702Authorization` exists
 * and does produce a genuine EIP-7702 authorization signature — but
 * it only signs the authorization tuple. There's no confirmed hook to
 * actually SEND a type-4 transaction with that authorization
 * attached (`UnsignedTransactionRequest` has no `authorizationList`
 * field either). Building real batching would mean bypassing Privy's
 * hooks entirely and hand-rolling a raw `eth_sendTransaction` RPC call
 * against the embedded wallet's own EIP-1193 provider with
 * 7702-specific fields — genuinely uncertain, undocumented behavior
 * for an embedded wallet, not something to ship without verifying
 * against a real transaction first.
 *
 * Rather than leave `submitSquadBatched` in place calling a method
 * that doesn't exist (which would fail at runtime with a confusing
 * error, or silently do the wrong thing), it's been removed. The
 * one-tap, single-signature claim from the original pitch is NOT
 * currently deliverable against this SDK version — that's a real
 * correction to the product's headline mechanic, not a minor
 * implementation detail, and is called out prominently in
 * docs/PHASE-4-SQUAD-BUILDER.md rather than buried here.
 *
 * `submitSquadSequential` below is the sole real, working submission
 * path — every pick signs and sends as its own transaction via the
 * confirmed unified `createOrder` verb.
 */
export async function submitSquadSequential(
  exchange: SomniaMarkets,
  picks: SquadPickInput[],
  onProgress?: (completed: number, total: number) => void,
  options: SubmissionOptions = {},
): Promise<SubmissionReceipt[]> {
  const receipts: SubmissionReceipt[] = [];

  // The board is server-curated and may have been loaded several minutes ago.
  // Refresh instead of using an already-populated browser registry: a market
  // can lock or resolve while the user is assembling a squad. In that case
  // calling `market(id)` against the old registry throws the SDK's opaque
  // "unknown market ref" error before an order is sent.
  await exchange.loadMarkets(options.refreshMarkets ?? true);

  // `.entries()` yields a non-optional `pick` (unlike `picks[i]`, which is
  // `T | undefined` under noUncheckedIndexedAccess) while still giving the
  // index needed for progress callbacks and 1-based error messages.
  for (const [i, pick] of picks.entries()) {
    const onchain = await exchange.client.getMarketOnchain(pick.onchainMarketId);
    if (onchain.status !== 1) {
      throw new Error(`Market ${pick.onchainMarketId} is no longer trading. Refresh the board and choose an open market.`);
    }

    let tradable;
    try {
      tradable = exchange.market(pick.onchainMarketId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown market";
      if (message.includes("unknown market ref")) {
        throw new Error(
          "One of your selected markets is no longer available for trading. Refresh the board and choose an open market."
        );
      }
      throw err;
    }
    const upSymbol = tradable.symbol;

    const book = await exchange.fetchOrderBook(upSymbol, 5);
    const bestAsk = book.asks[0]?.[0];
    const bestBid = book.bids[0]?.[0];
    const entryImpliedProbability =
      bestAsk !== undefined && bestBid !== undefined ? (bestAsk + bestBid) / 2 : bestAsk ?? bestBid ?? 0.5;

    // A "market" order here is an IOC placed at the price extreme (order-building.ts):
    // it fills against resting liquidity and cancels any unfilled remainder. If the
    // book is empty there's nothing to cross, so the contract reverts with the bare
    // ImmediateOrCancelNoFill() selector. Catch that ahead of time with a clear
    // message instead of surfacing the raw revert.
    if (bestAsk === undefined && bestBid === undefined) {
      throw new Error(
        `No one is quoting ${pick.onchainMarketId.slice(0, 8)}… right now, so a ${pick.direction.toUpperCase()} order can't fill. Pick a market with a live order book (a spread/best bid-ask showing) and try again.`
      );
    }

    const ref = pick.direction === "up" ? upSymbol : `${upSymbol.replace(/#YES$/, "")}#NO`;

    // Size the order so the STAKE is the ceiling on what leaves the wallet — the
    // player's whole ask here. A market buy crosses the ask, and the SDK escrows
    // quantity × (crossing ask × (1 + slippage)); sizing quantity off the mid
    // (stake / mid) therefore escrows MORE than the stake whenever the ask sits
    // above the mid — the "cruel" overcharge. Instead, cap contracts to what the
    // stake buys at the WORST fill price, so a $6 bet escrows ~$6, never more:
    // the wallet simply gets fewer contracts. UP fills at the YES ask; DOWN buys
    // NO, whose ask is (1 − best YES bid). Fall back to the mid-implied side price
    // when a side of the book is missing. `entryImpliedProbability` (the mid) is
    // still what scoring records — only the on-chain sizing changes.
    const SLIPPAGE = 0.03;
    const sideAsk =
      pick.direction === "up"
        ? bestAsk ?? entryImpliedProbability
        : bestBid !== undefined
          ? 1 - bestBid
          : 1 - entryImpliedProbability;
    const worstFillPrice = Math.min(0.999, Math.max(0.01, sideAsk) * (1 + SLIPPAGE));
    const contracts = pick.stakeUsd / worstFillPrice;

    // createOrder("market", ...) reads the opposite book again to calculate
    // this same protective IOC price. Direct board trades already fetched a
    // fresh book above, so reuse that snapshot and avoid a duplicate RPC. The
    // SDK maps limit + IOC to the same on-chain MARKET order type; only the
    // price source changes. The default path remains unchanged for squads.
    const crossingPrice = Math.min(0.999, Math.max(0.01, sideAsk * (1 + SLIPPAGE)));

    let order;
    try {
      order = options.reuseOrderBook
        ? await exchange.createOrder(ref, "limit", "buy", contracts, crossingPrice, { timeInForce: "IOC" })
        : await exchange.createOrder(ref, "market", "buy", contracts, undefined, { slippage: SLIPPAGE });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("ImmediateOrCancelNoFill")) {
        throw new Error(
          `Your ${pick.direction.toUpperCase()} order on pick ${i + 1} found no matching liquidity to fill against (the book moved or is too thin at this size). Try a smaller stake or a different market.`
        );
      }
      throw err;
    }

    const info = order.info as { receipt?: { transactionHash?: `0x${string}` } };
    const transactionHash = info.receipt?.transactionHash;
    if (!transactionHash) throw new Error(`Order for pick ${i + 1} did not return a transaction hash`);

    receipts.push({ pick, entryImpliedProbability, transactionHash });
    onProgress?.(i + 1, picks.length);
  }

  return receipts;
}

export type { SquadPickInput };
