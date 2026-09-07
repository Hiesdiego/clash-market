"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";


type SquadNotification = {
  key: string;
  squadId: string;
  leagueType: string;
  totalScore: number;
  timestamp: string;
};

export function SettlementNotifications() {
  const [items, setItems] = useState<SquadNotification[]>([]);
  const [open, setOpen] = useState(false);
  // Read state is now owned by the account (see /api/notifications/reads), not
  // the browser: localStorage reset on every re-sign-in / new device, so read
  // notifications kept popping back as unread. `readsLoaded` gates the badge so
  // it never flashes a full unread count before the server state arrives.
  const [readKeys, setReadKeys] = useState<Set<string>>(new Set());
  const [readsLoaded, setReadsLoaded] = useState(false);
  const [pulse, setPulse] = useState(false);
  const knownKeys = useRef<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/squads/history", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { squads?: Array<{ id: string; league_type: string; status: string; total_score: number; submitted_at: string | null; created_at: string }> };
      const settled = (body.squads ?? [])
        .filter((s) => s.status === "settled")
        .map<SquadNotification>((s) => ({
          key: `squad-${s.id}`,
          squadId: s.id,
          leagueType: s.league_type,
          totalScore: s.total_score,
          timestamp: s.submitted_at ?? s.created_at,
        }))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 12);

      // Detect genuinely-new keys (arrived since last poll) to pulse the badge —
      // but never force the panel open.
      const incoming = new Set(settled.map((s) => s.key));
      if (knownKeys.current.size > 0) {
        for (const key of incoming) {
          if (!knownKeys.current.has(key)) {
            setPulse(true);
            break;
          }
        }
      }
      knownKeys.current = incoming;
      setItems(settled);
    } catch {
      // Notifications are non-critical; a failed poll leaves the last state.
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 15000);
    // Also react to realtime settlement writes, but only as a nudge to refetch
    // the user's own scoped feed — not as a source of global rows.
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("settlement-refresh")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_wall_events" }, () => load())
      .subscribe();
    return () => {
      window.clearInterval(id);
      supabase.removeChannel(channel);
    };
  }, [load]);

  // Load the account's read state once. This is the source of truth — it
  // follows the user across devices/sign-ins, unlike the old localStorage.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/notifications/reads", { cache: "no-store" });
        if (res.ok) {
          const body = (await res.json()) as { keys?: string[] };
          if (!cancelled) setReadKeys(new Set(body.keys ?? []));
        }
      } catch {
        // Non-critical: an unreachable read-state fetch just means the badge
        // may show until the next poll; it never blocks the feed.
      } finally {
        if (!cancelled) setReadsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Hold the badge at zero until the account's read state has loaded, so a
  // returning player never sees a flash of "everything unread".
  const unreadCount = useMemo(
    () => (readsLoaded ? items.filter((i) => !readKeys.has(i.key)).length : 0),
    [items, readKeys, readsLoaded]
  );

  function markRead(keys: string[]) {
    const fresh = keys.filter((k) => !readKeys.has(k));
    if (fresh.length === 0) return;
    // Optimistic locally, then persist to the account (best-effort — the
    // on-screen state is already correct; a failed write just re-syncs on the
    // next load).
    setReadKeys((prev) => {
      const next = new Set(prev);
      fresh.forEach((k) => next.add(k));
      return next;
    });
    void fetch("/api/notifications/reads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keys: fresh }),
    }).catch(() => {
      // Swallow: read state is non-critical and reconciles on the next fetch.
    });
  }

  function toggle() {
    setOpen((v) => {
      const next = !v;
      if (next) setPulse(false);
      return next;
    });
  }

  return (
    <div ref={containerRef} className="relative z-30">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={`${unreadCount} unread settlement notification${unreadCount === 1 ? "" : "s"}`}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-full border text-chalk-300 transition",
          open ? "border-accent bg-pitch-800 text-accent" : "border-chalk-700 bg-pitch-900 hover:border-chalk-500 hover:text-chalk-100"
        )}
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-loss px-1 text-[10px] font-bold text-white",
              pulse && "animate-[pulse-live_1.2s_ease-in-out_infinite]"
            )}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          className={cn(
            // Mobile: the bell isn't the right-most header item (the wallet
            // button sits to its right), so anchoring the panel to the bell
            // shoved it off toward the edge. Pin it centered under the header
            // instead. It's still a DOM child of the container, so the
            // outside-click handler keeps working.
            "fixed left-1/2 top-16 z-50 w-[calc(100vw-1.5rem)] max-w-sm -translate-x-1/2",
            // sm+: restore the anchored dropdown under the bell.
            "sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-[22rem] sm:translate-x-0",
            "rounded-2xl border border-chalk-700 bg-pitch-900 p-4 shadow-2xl"
          )}
          aria-label="Settlement notifications"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-accent">Your results</p>
              <h2 className="mt-0.5 font-display text-lg text-chalk-100">Settlements</h2>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markRead(items.map((i) => i.key))}
                className="text-xs text-chalk-500 transition hover:text-chalk-100"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-chalk-500">No settled squads yet. Your results land here.</p>
            ) : (
              items.map((item) => {
                const isRead = readKeys.has(item.key);
                // A positive score means at least one pick landed → there's
                // collateral to redeem. Send those to /claim (wins don't
                // auto-pay); a scoreless settlement just goes to the book.
                const hasWinnings = item.totalScore > 0;
                return (
                  <Link
                    key={item.key}
                    href={hasWinnings ? "/claim" : "/positions"}
                    onClick={() => markRead([item.key])}
                    className={cn(
                      "block rounded-xl border p-3 text-sm transition",
                      isRead ? "border-chalk-800 bg-pitch-950/40 opacity-60" : "border-accent/30 bg-accent/5"
                    )}
                  >
                    <p className="capitalize text-chalk-100">
                      {item.leagueType} squad settled
                    </p>
                    <p className="mt-1 text-xs text-accent">
                      Final score {item.totalScore.toFixed(1)} · {hasWinnings ? "Redeem winnings →" : "View positions →"}
                    </p>
                  </Link>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
