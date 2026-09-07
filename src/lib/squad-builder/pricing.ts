import {
  CAPTAIN_MULTIPLIER,
  SPOTTER_MAX_IMPLIED_PROBABILITY,
  SPOTTER_MULTIPLIER,
  TRIPLE_CAPTAIN_MULTIPLIER,
  UNDERDOG_THRESHOLD,
} from "@/lib/constants/leagues";

export type ChipType = "triple_captain" | "spotter";

/**
 * "Conviction Scoring" — the pitch's headline scoring fix. Base score
 * is a function of entry implied probability and outcome: correctly
 * picking a market priced at 82% earns less than correctly picking one
 * priced at 34%, using the real number streamed off DreamDEX's own
 * order book rather than a flat +3/-3 a design team invented.
 *
 * Formula choice, stated plainly since the pitch describes the
 * *property* ("fewer points for the safe pick") but not an exact
 * function: score = (1 - entryProbability) * 10 for a correct pick,
 * scaled so a coin-flip (p=0.5) pick scores 5, a heavy favorite
 * (p=0.9) scores 1, and a long shot (p=0.1) scores 9. An incorrect
 * pick scores 0 — no negative points, unlike the flat +3/-3 system it
 * replaces, since Captain's doubling already carries the downside risk
 * (a wrong Captain call loses double the points a wrong regular pick
 * would have scored, without needing a separate penalty rule). Revisit
 * this exact curve once real testnet play data exists to tune against;
 * flagged as a stated formula, not a researched one.
 */
const SCORE_SCALE = 10;

export function scorePick(
  entryImpliedProbability: number,
  correct: boolean,
  isCaptain: boolean,
  chipType: ChipType | null = null,
): number {
  if (!correct) return 0;
  const base = (1 - entryImpliedProbability) * SCORE_SCALE;
  if (chipType === "spotter" && entryImpliedProbability < SPOTTER_MAX_IMPLIED_PROBABILITY) {
    return base * SPOTTER_MULTIPLIER;
  }
  if (isCaptain) return base * (chipType === "triple_captain" ? TRIPLE_CAPTAIN_MULTIPLIER : CAPTAIN_MULTIPLIER);
  return base;
}

export function isUnderdogGiantKilling(entryImpliedProbability: number, correct: boolean, isCaptain: boolean) {
  return isCaptain && correct && entryImpliedProbability < UNDERDOG_THRESHOLD;
}

export interface ProjectedPick {
  entryImpliedProbability: number;
  isCaptain: boolean;
  chipType?: ChipType | null;
}

/**
 * The Squad Builder's projected-score preview (Phase 4 exit criteria:
 * "a user can see, before submitting, roughly what a correct vs
 * incorrect outcome on each leg... would mean for their score").
 * Returns the score for each leg under both outcomes, not a single
 * blended number — showing the actual range is more honest than a
 * probability-weighted expected value that could read as a promise.
 */
export function projectPickOutcomes(pick: ProjectedPick) {
  return {
    ifCorrect: scorePick(pick.entryImpliedProbability, true, pick.isCaptain, pick.chipType),
    ifIncorrect: scorePick(pick.entryImpliedProbability, false, pick.isCaptain, pick.chipType),
  };
}

/**
 * Projected MONEY outcome for a wager, kept deliberately separate from
 * scorePick's fantasy POINTS — the two are different currencies and
 * conflating them (e.g. doubling a Captain's *stake*) was a real bug.
 *
 * A market buy of `stakeUsd` collateral at implied probability `p` buys
 * `stakeUsd / p` outcome tokens, each redeeming for $1 if the pick wins
 * (gotcha #11: winners redeem 1:1, fee 0). So gross payout on a win is
 * `stakeUsd / p` and profit is `stakeUsd * (1/p − 1)`; a loss returns 0.
 * This mirrors submit.ts's `createOrder(..., stakeUsd / entryImpliedProbability, ...)`
 * — the same contracts figure that actually goes on-chain.
 */
export function projectPayout(stakeUsd: number, entryImpliedProbability: number) {
  const p = Math.min(Math.max(entryImpliedProbability, 0.0001), 0.9999);
  const payout = stakeUsd / p;
  return { payout, profit: payout - stakeUsd, multiple: 1 / p };
}
