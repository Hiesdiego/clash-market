-- Reference data only — these three rows describe the fixed league
-- taxonomy itself (mirrors src/lib/constants/leagues.ts), not fake
-- business data. Nothing else is seeded here: markets, users, squads,
-- etc. must all come from real signups and the real Phase 3 sync job
-- against live DreamDEX testnet data, per the no-mocking constraint.
--
-- Window boundaries CORRECTED in Phase 4 against the real SDK's shipped
-- types: DreamDEX only creates markets at 900s/3600s/14400s/86400s
-- (15m/1h/4h/24h) — no 5-min, no multi-day/weekly window exists on the
-- venue. Horizon is the LONGEST real window (24h), not weekly as the
-- original build plan envisioned. See lib/dreamdex/classify.ts's
-- top comment and docs/PHASE-4-SQUAD-BUILDER.md for the full context.

insert into league_types (id, label, window_min_seconds, window_max_seconds, round_cadence) values
  ('blitz',   'Blitz',   900,   900,     'continuous'),
  ('classic', 'Classic', 3600,  14400,   'daily'),
  ('horizon', 'Horizon', 86400, 86400,   'weekly')
on conflict (id) do update set
  label = excluded.label,
  window_min_seconds = excluded.window_min_seconds,
  window_max_seconds = excluded.window_max_seconds,
  round_cadence = excluded.round_cadence;
