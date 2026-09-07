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

  const marketStates = await Promise.all(
    marketIds.map(async (marketId) => {
      const market = await exchange.client.getMarketOnchain(marketId as `0x${string}`);
      const finalized = market.status === 4
        ? await exchange.client.getBinaryMarket(marketId as `0x${string}`)
        : null;
      return { marketId, status: market.status, finalized };
    }),
  );
  const statusById = new Map(marketStates.map((state) => [state.marketId, state.status]));
  const finalizedById = new Map(
    marketStates
      .filter((state) => state.finalized)
      .map((state) => [state.marketId, state.finalized!]),
  );

  let tradesSettled = 0;
  let tradesVoided = 0;

  for (const trade of trades) {
    const marketId = trade.onchain_market_id.toLowerCase();
    const status = statusById.get(marketId);

    if (status === 5) {
      const { error: updateError } = await admin
        .from("solo_trades")
        .update({ status: "voided", outcome: "voided", points_awarded: 0, settled_at: new Date().toISOString() })
        .eq("id", trade.id)
        .eq("status", "open");
      if (updateError) throw updateError;
      tradesVoided++;
      continue;
    }

    if (status !== 4) continue;


    const finalizedMarket = finalizedById.get(marketId);
    const outcome = finalizedMarket?.winningOutcome === 0
      ? "up"
      : finalizedMarket?.winningOutcome === 1
        ? "down"
        : null;
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
