import { ImageResponse } from "next/og";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "edge";

export async function GET(_request: Request, { params }: { params: Promise<{ date: string; rank: string }> }) {
  const { date, rank: rankParam } = await params;
  const rank = Number(rankParam);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || ![1, 2, 3].includes(rank)) return new Response("Invalid card", { status: 400 });
  const periodStart = new Date(`${date}T00:00:00+01:00`).toISOString();
  const admin = createSupabaseAdminClient();
  const { data: rows } = await admin
    .from("daily_prediction_leaderboard")
    .select("user_id, points, correct_predictions, best_streak")
    .eq("period_start", periodStart)
    .order("points", { ascending: false })
    .order("correct_predictions", { ascending: false })
    .limit(3);
  const winner = rows?.[rank - 1];
  if (!winner) return new Response("Winner not found", { status: 404 });
  const { data: user } = await admin.from("users").select("display_name, wallet_address").eq("id", winner.user_id).single();
  const name = user?.display_name ?? `${user?.wallet_address?.slice(0, 6)}…${user?.wallet_address?.slice(-4)}`;
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";

  return new ImageResponse(
    <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#07110d", color: "#f4f7f4", padding: 58, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#ffd23f", fontSize: 30, letterSpacing: 5 }}>CLASH PREDICTION HIGH RANK</span>
        <span style={{ fontSize: 46 }}>{medal}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ color: "#8ea297", fontSize: 28 }}>#{rank} daily winner · {date}</span>
        <span style={{ marginTop: 16, fontSize: 76, fontWeight: 700 }}>{name}</span>
        <div style={{ display: "flex", gap: 36, marginTop: 28, fontSize: 30 }}>
          <span style={{ color: "#3ddc84" }}>{Number(winner.points).toFixed(0)} points</span>
          <span style={{ color: "#ffd23f" }}>{winner.correct_predictions} correct calls</span>
          <span style={{ color: "#ff8c42" }}>🔥 {winner.best_streak} streak</span>
        </div>
      </div>
      <span style={{ color: "#6b7d72", fontSize: 24 }}>Clash Markets · The market remembers who called it.</span>
    </div>,
    { width: 1200, height: 630 },
  );
}
