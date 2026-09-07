import { formatUnits } from "viem";
import type { SomniaMarkets, ClaimablePosition, BinaryMarket } from "@somnia-chain/markets-sdk";
import { getPublicEnv } from "@/lib/env";
import { somniaMainnet, somniaTestnet, COLLATERAL } from "@/lib/chains/somnia";

export type ClaimKind = "win" | "void";
export type ClaimSide = "up" | "down";

export interface ClaimablePositionView extends ClaimablePosition {
  /** "win" (market resolved in this side's favour) or "void" (both sides pay half). */
  kind: ClaimKind;
  /** outcomeIdx in the app's directional vocabulary (0 = YES = up, 1 = NO = down). */
  side: ClaimSide;
  /** Best-effort underlying asset (e.g. "BTC"); undefined beyond the join window. */
  asset?: string;
  /** Best-effort human label (the market question, falling back to the asset). */
  label?: string;
}

// --- network-scoped chain + collateral (mirrors browser-client.ts) ---

function activeNetwork(): "testnet" | "mainnet" {
  return getPublicEnv().NEXT_PUBLIC_SOMNIA_NETWORK === "mainnet" ? "mainnet" : "testnet";
}

export function activeChain() {
  return activeNetwork() === "mainnet" ? somniaMainnet : somniaTestnet;
}

export function activeCollateral() {
  return activeNetwork() === "mainnet" ? COLLATERAL.mainnet : COLLATERAL.testnet;
}

/** Format a raw collateral amount (estPayout / amount / wallet balance) — no symbol. */
export function formatCollateral(raw: bigint): string {
  return Number(formatUnits(raw, activeCollateral().decimals)).toFixed(2);
}

/** Sum estimated payout across positions (raw units). */
export function sumEstPayout(positions: ClaimablePosition[]): bigint {
  return positions.reduce((acc, p) => acc + p.estPayout, 0n);
}

// --- win / void classification ---

function deriveKind(p: ClaimablePosition, market?: BinaryMarket): ClaimKind {
  // Most reliable when the market is still in the enrichment window.
  if (market) {
    if (market.winningOutcome != null) return "win"; // resolved to a single side
    if (market.payoutNumerators != null) return "void"; // resolved to a uniform vector = void
  }
  // Next: the position's own lifecycle status ("Resolved" | "Voided" | "Finalized").
  const s = p.status.toLowerCase();
  if (s.includes("void")) return "void";
  if (s.includes("resolved") || s.includes("final")) return "win";
  // Enrichment-independent fallback on the payout shape (gotcha #11): a winner
  // pays amount × (1 − fee) — fees are single/double-digit bps, always > amount/2;
  // a void pays exactly amount/2 (the integer floor still satisfies ≤ amount/2).
  return p.estPayout * 2n <= p.amount ? "void" : "win";
}

/**
 * Every redeemable position for `account`, best-effort enriched with the
 * underlying asset/label and a win/void classification. Two pure reads — no
 * signer, no `loadMarkets()`:
 *   1. `getClaimable(account)` — the authoritative list; each item carries the
 *      `marketId` / `outcomeIdx` / `amount` that redeemMany consumes verbatim.
 *   2. `listPastBinaryMarkets({ limit })` — a bulk snapshot, joined by lowercased
 *      `marketId` only to LABEL rows. No status filter, to catch Resolved /
 *      Voided / Finalized alike. Redemption never depends on this join, so a
 *      position on a market beyond the window simply shows a generic label.
 */
export async function loadClaimable(exchange: SomniaMarkets, account: string): Promise<ClaimablePositionView[]> {
  const positions = await exchange.client.getClaimable(account);
  if (positions.length === 0) return [];

  const byId = new Map<string, BinaryMarket>();
  try {
    const past = await exchange.client.listPastBinaryMarkets({ limit: 200 });
    for (const m of past) byId.set(m.marketId.toLowerCase(), m);
  } catch {
    // Labels are cosmetic; a failed snapshot must never block claiming.
  }

  return positions.map((p) => {
    const market = byId.get(p.marketId.toLowerCase());
    return {
      ...p,
      kind: deriveKind(p, market),
      side: p.outcomeIdx === 0 ? "up" : "down",
      asset: market?.asset,
      label: market?.question ?? market?.asset,
    };
  });
}

// --- writes (a signer must already be bound to `exchange`) ---

/** Claim every position in ONE atomic transaction (batch redeem). */
export async function redeemAll(exchange: SomniaMarkets, positions: ClaimablePosition[]) {
  return exchange.trader.redeemMany({
    entries: positions.map((p) => ({
      marketId: p.marketId as `0x${string}`,
      outcomeIdx: p.outcomeIdx,
      amount: p.amount,
    })),
  });
}

/**
 * Claim a single position with an EXPLICIT `outcomeIdx`. The explicit index is
 * the correction the docs stress: on a voided market there is no winning side
 * for the module to infer, so never let it look one up — pass the side we hold.
 */
export async function redeemOne(exchange: SomniaMarkets, position: ClaimablePosition) {
  return exchange.trader.redeem({
    marketId: position.marketId as `0x${string}`,
    outcomeIdx: position.outcomeIdx,
    amount: position.amount,
  });
}
