

export type LeagueType = "blitz" | "classic" | "horizon";
export type MarketStatus = "listed" | "trading" | "locked" | "resolved" | "voided";
export type SquadStatus = "draft" | "submitted" | "settled";
export type PickDirection = "up" | "down";
export type PickOutcome = "correct" | "incorrect" | "voided";
export type SessionKeyStatus = "active" | "revoked" | "expired";
export type RoundStatus = "open" | "locked" | "settled";
export type ChipType = "triple_captain" | "spotter";

/**
 * supabase-js's `GenericSchema` (see @supabase/supabase-js's GenericTable /
 * GenericView) requires every table to expose Row/Insert/Update/Relationships
 * and every view to expose Row/Relationships. If any relation misses these,
 * `Database["public"]` fails the client's `Schema extends GenericSchema`
 * guard, `Schema` collapses to `never`, and then EVERY `.from(...).select()`
 * row degrades to `never` while every `.rpc()` argument degrades to
 * `undefined`. (That is the systemic "everything is never" symptom, not a
 * per-query mistake.)
 *
 * Rather than hand-encode per-column nullability/defaults for the Insert and
 * Update variants — which only a real `supabase gen types` run against a live
 * database can get exactly right — we derive them structurally from each Row:
 * every column optional. That is permissive enough to compile the real
 * inserts/upserts/updates this app performs while still rejecting misspelled
 * column names via excess-property checks. Relationships are intentionally
 * empty (`[]`): this codebase never uses PostgREST embedded-resource selects
 * (`select("*, other(*)")`), so there are no foreign-key hints to encode.
 */
type TableFromRow<Row extends Record<string, unknown>> = {
  Row: Row;
  Insert: { [K in keyof Row]?: Row[K] };
  Update: { [K in keyof Row]?: Row[K] };
  Relationships: [];
};

type ViewFromRow<Row extends Record<string, unknown>> = {
  Row: Row;
  Relationships: [];
};

/**
 * The column shapes for each relation — the single source of truth for this
 * stopgap. `Database` below wraps each of these with `TableFromRow` /
 * `ViewFromRow` so the whole schema satisfies `GenericSchema` without
 * repeating Insert/Update/Relationships boilerplate 20 times.
 */
interface TableRows {
  league_types: {
    id: LeagueType;
    label: string;
    window_min_seconds: number;
    window_max_seconds: number;
    round_cadence: "continuous" | "daily" | "weekly";
    live_enabled: boolean;
  };
  users: {
    id: string;
    auth_user_id: string | null;
    wallet_address: string;
    privy_user_id: string;
    privy_wallet_id: string | null;
    referred_by: string | null;
    display_name: string | null;
    created_at: string;
    updated_at: string;
  };
  session_keys: {
    id: string;
    user_id: string;
    public_address: string;
    scope: { trade: boolean; redeem: boolean; withdraw: boolean };
    status: SessionKeyStatus;
    expires_at: string;
    created_at: string;
    revoked_at: string | null;
  };
  markets: {
    id: string;
    onchain_market_id: string;
    underlying: string;
    // Null for valid DreamDEX cadences that are visible in the all-markets
    // discovery feed but are not curated into a Clash league yet.
    league_type: LeagueType | null;
    window_length_seconds: number;
    opens_at: string;
    expires_at: string;
    status: MarketStatus;
    resolution_outcome: "up" | "down" | null;
    raw_snapshot: Record<string, unknown> | null;
    last_synced_at: string;
    featured: boolean;
    excluded: boolean;
    best_bid: number | null;
    best_ask: number | null;
    spread: number | null;
    book_checked_at: string | null;
    created_at: string;
  };
  seasons: {
    id: string;
    league_type: LeagueType;
    label: string;
    starts_at: string;
    ends_at: string | null;
    is_active: boolean;
    created_at: string;
  };
  rounds: {
    id: string;
    season_id: string;
    league_type: LeagueType;
    starts_at: string;
    locks_at: string;
    ends_at: string;
    status: RoundStatus;
    created_at: string;
  };
  squads: {
    id: string;
    user_id: string;
    round_id: string;
    league_type: LeagueType;
    status: SquadStatus;
    submitted_tx_hash: string | null;
    submitted_at: string | null;
    total_score: number;
    chip_type: ChipType | null;
    created_at: string;
  };
  league_chip_uses: {
    id: string;
    user_id: string;
    season_id: string;
    league_type: LeagueType;
    chip_type: ChipType;
    squad_id: string;
    used_at: string;
  };
  picks: {
    id: string;
    squad_id: string;
    market_id: string;
    direction: PickDirection;
    is_captain: boolean;
    entry_implied_probability: number;
    stake_usd: number;
    onchain_order_id: string | null;
    onchain_tx_hash: string | null;
    outcome: PickOutcome | null;
    points_awarded: number | null;
    redeemed: boolean;
    redeemed_tx_hash: string | null;
    settled_at: string | null;
    created_at: string;
  };
  solo_trades: {
    id: string;
    user_id: string;
    onchain_market_id: string;
    market_id: string | null;
    underlying: string;
    question: string | null;
    direction: PickDirection;
    stake_usd: number;
    entry_implied_probability: number | null;
    onchain_tx_hash: string;
    status: "open" | "settled" | "voided";
    outcome: PickOutcome | null;
    points_awarded: number | null;
    created_at: string;
    settled_at: string | null;
    streak_count: number;
    streak_multiplier: number;
  };
  prediction_streaks: {
    user_id: string;
    current_streak: number;
    updated_at: string;
  };
  daily_prediction_leaderboard: {
    period_start: string;
    user_id: string;
    points: number;
    correct_predictions: number;
    best_streak: number;
    updated_at: string;
  };
  faucet_claims: {
    id: string;
    user_id: string;
    wallet_address: string;
    claim_date: string;
    stt_amount: number;
    tusdc_amount: number;
    stt_tx_hash: string | null;
    tusdc_tx_hash: string | null;
    status: "pending" | "completed" | "failed";
    error_message: string | null;
    created_at: string;
    completed_at: string | null;
  };
  clans: {
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    join_code: string;
    league_type: LeagueType;
    registered_at: string | null;
    created_at: string;
  };
  clan_memberships: {
    clan_id: string;
    user_id: string;
    role: "owner" | "member";
    joined_at: string;
  };
  clash_leagues: {
    id: string;
    name: string;
    join_code: string;
    league_type: LeagueType;
    creator_id: string;
    is_clan_league: boolean;
    clan_id: string | null;
    created_at: string;
  };
  clash_league_memberships: {
    league_id: string;
    user_id: string;
    joined_at: string;
  };
  edge_score_history: {
    id: string;
    user_id: string;
    window_start: string;
    window_end: string;
    captured_spread: number | null;
    adverse_selection: number | null;
    edge_score: number;
    percentile: number | null;
    computed_at: string;
  };
  practice_sessions: {
    id: string;
    anon_session_id: string;
    league_type: LeagueType;
    replayed_label: string;
    total_score: number;
    created_at: string;
  };
  practice_picks: {
    id: string;
    practice_session_id: string;
    market_id: string;
    direction: PickDirection;
    is_captain: boolean;
    entry_implied_probability: number;
    outcome: PickOutcome;
    points_awarded: number;
    created_at: string;
  };
  matchday_cards: {
    id: string;
    user_id: string;
    round_id: string;
    league_type: LeagueType;
    image_url: string | null;
    squad_snapshot: Record<string, unknown>;
    shared: boolean;
    shared_at: string | null;
    created_at: string;
  };
  live_wall_events: {
    id: string;
    league_type: LeagueType;
    underlying: string;
    direction: "up" | "down";
    is_captain: boolean;
    outcome: "correct" | "incorrect";
    points_awarded: number;
    is_giant_killing: boolean;
    created_at: string;
  };
  funnel_events: {
    id: string;
    event_type: "practice_session_started" | "converted_from_practice" | "referral_signup";
    user_id: string | null;
    anon_session_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  };
  notification_reads: {
    user_id: string;
    notification_key: string;
    read_at: string;
  };
  worker_health: {
    job_name: string;
    last_run_at: string | null;
    last_success_at: string | null;
    last_error: string | null;
    consecutive_failures: number;
    updated_at: string;
  };
}

interface ViewRows {
  user_season_totals: {
    user_id: string;
    season_id: string;
    league_type: LeagueType;
    cumulative_score: number;
    rounds_played: number;
  };
}

export interface Database {
  public: {
    Tables: { [K in keyof TableRows]: TableFromRow<TableRows[K]> };
    Views: { [K in keyof ViewRows]: ViewFromRow<ViewRows[K]> };
      Functions: {
        settle_solo_prediction: {
          Args: { p_trade_id: string; p_correct: boolean; p_settled_at?: string };
          Returns: { points: number; streak: number; multiplier: number }[];
        };
        claim_league_chip: {
          Args: { p_squad_id: string; p_chip_type: ChipType };
          Returns: null;
        };
        get_league_standings: {
        Args: { p_league_type: string; p_season_id?: string | null };
        Returns: {
          user_id: string;
          display_name: string | null;
          wallet_address: string;
          cumulative_score: number;
          rounds_played: number;
          rank: number;
        }[];
      };
      get_clash_league_standings: {
        Args: { p_league_id: string };
        Returns: {
          user_id: string;
          display_name: string | null;
          wallet_address: string;
          cumulative_score: number;
          rounds_played: number;
          rank: number;
        }[];
      };
      create_clash_league: {
        Args: { p_name: string; p_league_type: string };
        Returns: TableRows["clash_leagues"];
      };
      join_clash_league: {
        Args: { p_join_code: string };
        Returns: TableRows["clash_leagues"];
      };
      create_clan: {
        Args: { p_name: string; p_slug: string; p_league_type: string };
        Returns: TableRows["clans"];
      };
      join_clan: {
        Args: { p_join_code: string };
        Returns: TableRows["clans"];
      };
      register_clan: {
        Args: { p_clan_id: string };
        Returns: TableRows["clans"];
      };
      get_my_clans: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          name: string;
          slug: string;
          league_type: LeagueType;
          join_code: string;
          owner_id: string;
          is_owner: boolean;
          member_count: number;
          registered_at: string | null;
        }[];
      };
      get_clan_standings: {
        Args: { p_league_type?: string | null };
        Returns: {
          clan_id: string;
          clan_name: string;
          league_type: LeagueType;
          member_count: number;
          clan_total: number;
          rank: number;
        }[];
      };
      get_user_stats: {
        Args: { p_user_id: string };
        Returns: {
          current_streak: number;
          best_streak: number;
          captain_hit_rate: number | null;
          giant_killings: number;
        }[];
      };
      get_user_edge_score: {
        Args: { p_user_id: string; p_window?: number };
        Returns: {
          edge_score: number;
          sample_size: number;
          trend: { at: string; contribution: number }[];
        }[];
      };
      get_user_edge_percentile: {
        Args: { p_user_id: string; p_min_sample?: number };
        Returns: number | null;
      };
    };
  };
}
