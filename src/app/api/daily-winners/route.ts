import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function currentLagosPeriod() {
  const lagosNow = new Date(Date.now() + 60 * 60 * 1000);
  const date = lagosNow.toISOString().slice(0, 10);
  return { date, start: new Date(`${date}T00:00:00+01:00`).toISOString() };
}

/** Public FOMO surface: only the three winners are returned. */
export async function GET() {
  const { date, start } = currentLagosPeriod();
  const admin = createSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from("daily_prediction_leaderboard")
    .select("user_id, points, correct_predictions, best_streak")
    .eq("period_start", start)
    .order("points", { ascending: false })
    .order("correct_predictions", { ascending: false })
    .limit(3);
  if (error) return NextResponse.json({ date, winners: [] });

  const userIds = (rows ?? []).map((row) => row.user_id);
  const { data: users } = userIds.length
    ? await admin.from("users").select("id, display_name, wallet_address").in("id", userIds)
    : { data: [] };
  const byId = new Map((users ?? []).map((user) => [user.id, user]));
  return NextResponse.json({
    date,
    winners: (rows ?? []).map((row, index) => ({
      rank: index + 1,
      points: Number(row.points),
      correctPredictions: row.correct_predictions,
      bestStreak: row.best_streak,
      displayName: byId.get(row.user_id)?.display_name ?? null,
      walletAddress: byId.get(row.user_id)?.wallet_address ?? "",
    })),
  });
}
