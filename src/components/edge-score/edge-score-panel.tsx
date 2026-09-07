"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

interface EdgeScoreData {
  edge_score: number;
  sample_size: number;
  percentile: number | null;
  trend: { at: string; contribution: number }[];
}

/**
 * "Build the Edge Score UI: trend line over time, percentile placement
 * among active users, and plain-language tooltip education explaining
 * what it measures and why it matters — this surface is doing real
 * trust-building work, so it should never feel like a raw, unexplained
 * number." — build plan, Phase 8.
 *
 * Rendered as its own panel, never inside a StandingsTable row — this
 * is the "secondary display, not a competing leaderboard" decision
 * documented in 0010_edge_score.sql.
 */
export function EdgeScorePanel() {
  const [data, setData] = useState<EdgeScoreData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    fetch("/api/users/me/edge-score")
      .then((r) => r.json())
      .then((body) => (body.error ? setError(body.error) : setData(body)));
  }, []);

  if (error) return <p className="text-sm text-loss">{error}</p>;
  if (!data) return <p className="text-sm text-chalk-500">Loading...</p>;

  const chartData = data.trend.map((t, i) => ({ index: i, value: 50 + t.contribution * 50 }));

  return (
    <div className="rounded-card border border-chalk-700 bg-pitch-900 p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-chalk-100">Edge Score</h2>
        <button
          onClick={() => setShowInfo((s) => !s)}
          className="rounded-full border border-chalk-700 px-2 text-xs text-chalk-500"
        >
          ?
        </button>
      </div>

      {showInfo && (
        <p className="mt-2 rounded-card bg-pitch-950 p-3 text-xs text-chalk-300">
          Edge Score measures timing, not luck: did you commit to a pick early in its
          window — before the crowd moved the price — and turn out right, or did you
          wait until the outcome was nearly obvious before playing it safe? A 50 is
          neutral. Higher means your correct picks tend to come from real conviction,
          not hindsight.
        </p>
      )}

      <div className="mt-4 flex items-baseline gap-4">
        <span className="text-4xl font-display text-classic">{data.edge_score}</span>
        {data.percentile !== null && (
          <span className="text-sm text-chalk-500">top {(100 - data.percentile).toFixed(0)}%</span>
        )}
        <span className="text-xs text-chalk-500">({data.sample_size} scored picks)</span>
      </div>

      {chartData.length > 1 && (
        <div className="mt-4 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="index" hide />
              <YAxis domain={[0, 100]} hide />
              <Tooltip
                formatter={(value) => (typeof value === "number" ? value.toFixed(0) : String(value))}
                contentStyle={{ background: "#0c1a14", border: "1px solid #4d5f54" }}
              />
              <Line type="monotone" dataKey="value" stroke="#ffd23f" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.sample_size < 5 && (
        <p className="mt-2 text-xs text-chalk-500">Play a few more rounds to unlock a percentile.</p>
      )}
    </div>
  );
}
