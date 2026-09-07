"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { LEAGUE_CONFIG, LEAGUE_TYPES, type LeagueType } from "@/lib/constants/leagues";
import { cn } from "@/lib/cn";
import {
  AccentProvider,
  Badge,
  Card,
  Eyebrow,
  EmptyState,
  Skeleton,
  Tabs,
  type TabItem,
} from "@/components/ui";

interface WallEvent {
  id: string;
  league_type: LeagueType;
  underlying: string;
  direction: "up" | "down";
  is_captain: boolean;
  outcome: "correct" | "incorrect";
  points_awarded: number;
  is_giant_killing: boolean;
  created_at: string;
}

/** Compact relative timestamp for the ticker — "just now", "6m ago", "2h ago". */
function timeAgo(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** A single settled-pick row — the atom of the ticker. */
function WallRow({ event }: { event: WallEvent }) {
  const won = event.outcome === "correct";
  const giant = event.is_giant_killing;

  return (
    <Card
      glow={giant}
      className={cn("overflow-hidden", giant && "border-accent/50 bg-accent/10")}
    >
      <div className="flex items-center gap-3 p-3.5 sm:gap-4 sm:p-4">
        {/* Outcome-tinted direction marker */}
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border font-mono text-[13px]",
            won ? "border-gain/30 bg-gain/10 text-gain" : "border-loss/30 bg-loss/10 text-loss",
          )}
          aria-hidden
        >
          {event.direction === "up" ? "▲" : "▼"}
        </div>

        {/* What happened */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-display text-base leading-none tracking-wide text-chalk-100">
              {event.underlying}
            </span>
            {event.is_captain && (
              <Badge
                tone="accent"
                className="border-accent bg-accent uppercase tracking-wide text-[color:var(--accent-contrast)]"
              >
                Captain 2×
              </Badge>
            )}
            {giant && (
              <Badge
                tone="accent"
                className="border-accent bg-accent uppercase tracking-wide text-[color:var(--accent-contrast)]"
              >
                Giant-killing
              </Badge>
            )}
          </div>
          <div className="mt-1.5 flex min-w-0 items-center gap-2 text-xs text-chalk-500">
            <Badge tone="accent" className="uppercase tracking-widest">
              {LEAGUE_CONFIG[event.league_type].label}
            </Badge>
            <span className="truncate">
              {event.direction === "up" ? "Higher" : "Lower"} call {won ? "hit" : "missed"}
              {" · "}
              {timeAgo(event.created_at)}
            </span>
          </div>
        </div>

        {/* Points */}
        <div className="shrink-0 text-right">
          <div
            className={cn(
              "font-mono text-lg font-semibold leading-none tabular-nums sm:text-xl",
              won ? "text-gain" : "text-loss",
            )}
          >
            {won ? "+" : ""}
            {event.points_awarded.toFixed(1)}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-chalk-500">pts</div>
        </div>
      </div>
    </Card>
  );
}

/**
 * "The Live Wall: a public, spectator-facing screen... driven entirely
 * by Somnia Reactivity — every settlement, anywhere in the game,
 * pushes to the wall the instant DreamDEX resolves it." — build plan.
 *
 * The "no polling, no delay" property here comes from Supabase
 * Realtime on live_wall_events (Phase 7's purpose-built public table),
 * not from a direct Reactivity subscription to DreamDEX itself — the
 * chain-to-Clash-database hop still goes through Phase 5's settlement
 * sweep (a polling job, honestly labeled as such in that phase's doc).
 * From this table onward, though, delivery to every connected
 * spectator really is push-based and instant.
 *
 * Defaults to Blitz per the plan's own reasoning: "the feed that will
 * always have something resolving within a minute or two."
 */
export function LiveWall() {
  const [filter, setFilter] = useState<LeagueType>("blitz");
  const [events, setEvents] = useState<WallEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    setLoading(true);

    supabase
      .from("live_wall_events")
      .select("*")
      .eq("league_type", filter)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setEvents((data as WallEvent[]) ?? []);
        setLoading(false);
      });

    const channel = supabase
      .channel(`live-wall-${filter}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_wall_events", filter: `league_type=eq.${filter}` },
        (payload) => {
          setEvents((prev) => [payload.new as WallEvent, ...prev].slice(0, 30));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

  const tabs: TabItem<LeagueType>[] = LEAGUE_TYPES.map((lt) => ({
    value: lt,
    label: LEAGUE_CONFIG[lt].label,
  }));

  return (
    <AccentProvider league={filter} as="section">
      {/* Header — floodlit, league-tinted */}
      <header className="floodlight relative overflow-hidden rounded-2xl border border-chalk-800 p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <Eyebrow>The Live Wall</Eyebrow>
          <Badge tone="live" dot>
            LIVE
          </Badge>
        </div>
        <h1 className="mt-3 font-display text-3xl leading-[1.05] text-chalk-100 sm:text-4xl">
          Every win, the moment it lands
        </h1>
        <p className="mt-2 max-w-xl text-sm text-chalk-400">
          Settled picks from across the game, pushed to the wall the instant they resolve.
        </p>
      </header>

      {/* League switch */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <Tabs items={tabs} value={filter} onChange={setFilter} size="sm" />
        {!loading && events.length > 0 && (
          <span className="hidden font-mono text-xs tabular-nums text-chalk-500 sm:block">
            Latest {events.length}
          </span>
        )}
      </div>

      {/* Feed */}
      <div className="mt-4">
        {loading ? (
          <div className="space-y-2" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-chalk-800 bg-pitch-900/60 p-3.5 sm:p-4"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <Skeleton className="h-9 w-9 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-6 w-12" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon="📡"
            title="The wall is quiet"
            description="Be the first to settle a win — every resolved pick lands here the instant it's called."
          />
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {events.map((event) => (
                <motion.li
                  key={event.id}
                  layout
                  initial={{ opacity: 0, y: -12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.6 }}
                >
                  <WallRow event={event} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </AccentProvider>
  );
}
