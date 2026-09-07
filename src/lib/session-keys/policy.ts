import { DREAMDEX_CORE_CONTRACTS } from "@/lib/chains/somnia";


export const SESSION_KEY_SCOPE = {
  allowed: [
    {
      label: "Place trades",
      contract: DREAMDEX_CORE_CONTRACTS.marketsCore,
      description: "Submit squad picks as DreamDEX orders",
    },
    {
      label: "Redeem winnings",
      contract: DREAMDEX_CORE_CONTRACTS.binarySettlement,
      description: "Auto-claim settled winning positions back to your wallet",
    },
  ],
  neverAllowed: [
    "Withdraw or transfer any asset out of your wallet",
    "Approve token spending for any contract other than the two above",
    "Change your wallet's recovery or ownership settings",
  ],
} as const;

export const DEFAULT_SESSION_KEY_TTL_DAYS = 30;
