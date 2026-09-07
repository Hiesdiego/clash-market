export type SquadDirection = "up" | "down";

export type SquadMarket = {
  id: string;
  onchainMarketId: string;
  underlying: string;
  label: string;
  expiresAt: string;
  impliedProbability: number;
};

export type SquadPick = SquadMarket & {
  direction: SquadDirection;
  isCaptain: boolean;
};

export type SquadDraft = {
  leagueType: string;
  roundId: string;
  picks: SquadPick[];
};

export type SubmissionResult = {
  mode: "batch" | "sequential";
  transactionHashes: string[];
};

export type SquadSubmitter = (draft: SquadDraft) => Promise<SubmissionResult>;
