"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { CAPTAIN_MULTIPLIER } from "@/lib/constants/leagues";
import { scorePick } from "@/lib/squad-builder/pricing";
import { cn } from "@/lib/cn";

/**
 * "How points work" — the player-facing explanation of Conviction Scoring.
 * Every number shown is computed by the real `scorePick()` engine, so this
 * can never drift from what settlement actually awards. Surfaced in the
 * builder header and on the standings page (wherever intent is highest).
 */

// Worked examples pulled straight from the scoring function.
const EXAMPLES = [
  { label: "Long shot", prob: 0.1, hint: "The market barely believes it" },
  { label: "Coin flip", prob: 0.5, hint: "Genuine 50/50" },
  { label: "Heavy favorite", prob: 0.9, hint: "Priced as near-certain" },
] as const;

function TriggerButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-chalk-800 bg-pitch-950/60 px-2.5 py-1.5 text-xs font-medium text-chalk-300 transition-colors hover:border-accent/40 hover:text-accent",
        className,
      )}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      How points work
    </button>
  );
}

export function ScoringExplainer({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TriggerButton onClick={() => setOpen(true)} className={className} />
      <Modal open={open} onClose={() => setOpen(false)} title="How points work" size="md">
        <div className="space-y-6 text-sm text-chalk-300">
          <p className="leading-relaxed">
            You score for <span className="font-semibold text-chalk-100">conviction</span>, not just being right.
            The less likely the market thought your pick was, the more a correct call is worth — so nailing an
            underdog beats riding a favorite.
          </p>

          {/* The formula, stated cleanly. */}
          <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
            <p className="text-xs uppercase tracking-widest text-chalk-500">The formula</p>
            <p className="mt-2 font-mono text-sm text-chalk-100">
              points = (100% − entry odds) × 10
            </p>
            <p className="mt-2 text-xs text-chalk-500">
              Your <span className="text-chalk-300">Captain</span> scores{" "}
              <span className="font-semibold text-accent">{CAPTAIN_MULTIPLIER}×</span>. A wrong or voided pick scores{" "}
              <span className="text-chalk-300">0</span> — never negative.
            </p>
          </div>

          {/* Worked examples straight from scorePick(). */}
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-chalk-500">If your pick is correct</p>
            <div className="space-y-2">
              {EXAMPLES.map((ex) => {
                const base = scorePick(ex.prob, true, false);
                const capt = scorePick(ex.prob, true, true);
                return (
                  <div
                    key={ex.label}
                    className="flex items-center justify-between gap-3 rounded-xl border border-chalk-800 bg-pitch-950/60 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-chalk-100">{ex.label}</span>
                        <span className="font-mono text-xs text-chalk-500">{(ex.prob * 100).toFixed(0)}% odds</span>
                      </div>
                      <p className="mt-0.5 text-xs text-chalk-500">{ex.hint}</p>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      <span className="font-mono text-lg font-semibold tabular-nums text-chalk-100">
                        +{base.toFixed(0)}
                      </span>
                      <span className="text-chalk-600">/</span>
                      <span className="flex items-center gap-1 font-mono text-sm tabular-nums text-accent">
                        +{capt.toFixed(0)}
                        <Badge tone="accent" dot>
                          C
                        </Badge>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-chalk-500">
              Left = regular pick · Right = if it&apos;s your Captain
            </p>
          </div>

          <div className="rounded-xl border border-chalk-800 bg-pitch-950/40 px-4 py-3 text-xs leading-relaxed text-chalk-400">
            <span className="font-semibold text-chalk-200">Why it&apos;s built this way:</span> a flat &ldquo;+3 for
            right&rdquo; rewards the safe favorite as much as the brave call. Conviction Scoring uses the market&apos;s
            own live odds, so the leaderboard rewards reading the room better than everyone else.
          </div>
        </div>
      </Modal>
    </>
  );
}
