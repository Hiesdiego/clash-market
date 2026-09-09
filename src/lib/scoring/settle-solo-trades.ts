import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDreamDexReadClient } from "@/lib/dreamdex/client";

export interface SoloSettlementResult {
  tradesScanned: number;
  tradesSettled: number;
  tradesVoided: number;
}

type OpenSoloTrade = {
  id: string;
  onchain_market_id: string;
  direction: "up" | "down";
  created_at: string;
};


export async function settleSoloTrades(): Promise<SoloSettlementResult> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("solo_trades")
    .select("id, onchain_market_id, direction, created_at")
    .eq("status", "open");

  if (error) throw error;

  const trades = ((data ?? []) as OpenSoloTrade[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (trades.length === 0) {
    return { tradesScanned: 0, tradesSettled: 0, tradesVoided: 0 };
  }

  const exchange = getDreamDexReadClient();
  const marketIds = [...new Set(trades.map((trade) => trade.onchain_market_id.toLowerCase()))];

  // Read each market straight from chain (works before indexing). Crucially the
  // WINNER comes from this same on-chain read, NOT the indexer's getBinaryMarket
  // — that can still report a null winner for a market already resolved on-chain
  // (indexer lag), which would leave the trade stuck "open" forever. One
  // unreadable market must not strand every other trade's settlement.
  const onchainEntries = await Promise.all(
    marketIds.map(async (marketId) => {
      try {
        const onchain = await exchange.client.getMarketOnchain(marketId as `0x${string}`);
        return [marketId, onchain] as const;
      } catch (readError) {
        console.warn(
          `[worker][solo] on-chain read failed for ${marketId}:`,
          readError instanceof Error ? readError.message : String(readError),
        );
        return null;
      }
    }),
  );
  const onchainById = new Map(onchainEntries.filter((entry): entry is NonNullable<typeof entry> => entry !== null));

  let tradesSettled = 0;
  let tradesVoided = 0;

  for (const trade of trades) {
    const marketId = trade.onchain_market_id.toLowerCase();
    const onchain = onchainById.get(marketId);
    if (!onchain) continue;

    // Void is authoritative from the on-chain flag — redeem both sides, 0 points.
    if (onchain.isVoided || onchain.status === 5) {
      const { error: updateError } = await admin
        .from("solo_trades")
        .update({ status: "voided", outcome: "voided", points_awarded: 0, settled_at: new Date().toISOString() })
        .eq("id", trade.id)
        .eq("status", "open");
      if (updateError) throw updateError;
      tradesVoided++;
      continue;
    }

    // Not resolved on-chain yet — leave open, retry on the next sweep.
    if (!(onchain.isResolved || onchain.status === 4)) continue;

    // Winner read straight from chain (0 = YES = up, 1 = NO = down).
    const outcome = onchain.winningOutcome === 0 ? "up" : onchain.winningOutcome === 1 ? "down" : null;
    if (!outcome) continue;

    const correct = trade.direction === outcome;
    const { error: updateError } = await admin.rpc("settle_solo_prediction", {
      p_trade_id: trade.id,
      p_correct: correct,
      p_settled_at: new Date().toISOString(),
    });
    if (updateError) throw updateError;
    tradesSettled++;
  }

  return { tradesScanned: trades.length, tradesSettled, tradesVoided };
}
