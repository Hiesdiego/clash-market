"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

function formatRemaining(milliseconds: number) {
  const totalSeconds = Math.ceil(Math.max(0, milliseconds) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
}

/** Parse a chain/DB expiry (unix seconds, unix ms, or ISO) into epoch ms. */
export function toEpochMs(expiresAt: string | number): number {
  const numeric = Number(expiresAt);
  if (Number.isFinite(numeric)) {
    return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  }
  return new Date(expiresAt).getTime();
}

/** Shared ticking clock — one interval per component, updates every second. */
export function useCountdown(expiresAt: string | number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const remaining = toEpochMs(expiresAt) - now;
  return { remaining, label: formatRemaining(remaining), expired: remaining <= 0 };
}

export function MarketCountdown({ expiresAt, className }: { expiresAt: string | number; className?: string }) {
  const { remaining, label, expired } = useCountdown(expiresAt);
  const urgent = remaining > 0 && remaining <= 5 * 60 * 1000;

  return (
    <div
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-semibold tabular-nums",
        expired
          ? "border-loss/40 bg-loss/10 text-loss"
          : urgent
            ? "animate-[pulse-live_2s_ease-in-out_infinite] border-[color:var(--accent)]/60 bg-[color:var(--accent)]/10 text-[color:var(--accent)]"
            : "border-chalk-700 bg-pitch-950 text-chalk-300",
        className,
      )}
      aria-label={expired ? "Market expired" : `${label} remaining`}
    >
      {expired ? "Expired" : `Closes in ${label}`}
    </div>
  );
}
