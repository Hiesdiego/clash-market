
export const LEAGUE_TYPES = ["blitz", "classic", "horizon"] as const;
export type LeagueType = (typeof LEAGUE_TYPES)[number];

export const PICK_LIMITS_BY_LEAGUE: Record<LeagueType, { min: number; max: number }> = {
  blitz: { min: 2, max: 2 },
  classic: { min: 3, max: 3 },
  horizon: { min: 4, max: 4 },
};
export const MIN_PICKS_BY_LEAGUE: Record<LeagueType, number> = {
  blitz: 2,
  classic: 3,
  horizon: 4,
};
export const CAPTAIN_MULTIPLIER = 2;
export const TRIPLE_CAPTAIN_MULTIPLIER = 3;
export const SPOTTER_MULTIPLIER = 4;
export const CHIPS_PER_SEASON = 5;
export const SPOTTER_MAX_IMPLIED_PROBABILITY = 1 / 3;
export const UNDERDOG_THRESHOLD = 0.25; // implied probability below which a correct Captain call triggers the "GIANT-KILLING" moment

interface LeagueConfig {
  label: string;
  accentToken: "blitz" | "classic" | "horizon"; // maps to tailwind.config.ts colors
  windowLength: { min: string; max: string };
  roundCadence: string;
  tagline: string;
}

export const LEAGUE_CONFIG: Record<LeagueType, LeagueConfig> = {
  blitz: {
    label: "Blitz",
    accentToken: "blitz",
    windowLength: { min: "1m", max: "15m" },
    roundCadence: "continuous", // new round every 15-30 min, all day
    tagline: "A round is always live, somewhere.",
  },
  classic: {
    label: "Classic",
    accentToken: "classic",
    windowLength: { min: "1h", max: "4h" },
    roundCadence: "daily",
    tagline: "The flagship. One squad, one day.",
  },
  horizon: {
    label: "Horizon",
    accentToken: "horizon",
    windowLength: { min: "24h", max: "24h" },
    roundCadence: "weekly", // Clash opens a fresh round weekly; the market itself is a 24h window
    tagline: "The long game. One squad, a full week.",
  },
};

// Squad format is IDENTICAL across all three leagues (Changelog: this was
// a deliberate simplification) — only the board and the round timer differ.
export const SQUAD_FORMAT = {
  picksByLeague: PICK_LIMITS_BY_LEAGUE,
  captains: 1,
  captainMultiplier: CAPTAIN_MULTIPLIER,
} as const;
