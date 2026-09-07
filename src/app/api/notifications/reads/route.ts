import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";



const MAX_KEYS = 500;

async function resolveAppUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const, status: 401 as const };
  const { data: appUser } = await supabase.from("users").select("id").eq("auth_user_id", user.id).single();
  if (!appUser) return { error: "No linked Clash user for this session" as const, status: 404 as const };
  return { userId: appUser.id };
}

export async function GET() {
  const resolved = await resolveAppUserId();
  if ("error" in resolved) {
    // An unauthenticated caller simply has no read state — never error the feed.
    return NextResponse.json({ keys: [] });
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("notification_reads")
    .select("notification_key")
    .eq("user_id", resolved.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: (data ?? []).map((r) => r.notification_key) });
}

export async function POST(request: NextRequest) {
  const resolved = await resolveAppUserId();
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const body = await request.json().catch(() => ({}));
  const rawKeys = (body as { keys?: unknown }).keys;
  // Accept only sane string keys, de-duplicated and capped, so a bad/hostile
  // payload can't bloat the table.
  const keys = Array.isArray(rawKeys)
    ? [...new Set(rawKeys.filter((k): k is string => typeof k === "string" && k.length > 0 && k.length <= 200))].slice(
        0,
        MAX_KEYS
      )
    : [];
  if (keys.length === 0) {
    return NextResponse.json({ error: "keys (non-empty string array) required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("notification_reads").upsert(
    keys.map((notification_key) => ({ user_id: resolved.userId, notification_key })),
    // Already-read keys are a no-op; keep the original read_at.
    { onConflict: "user_id,notification_key", ignoreDuplicates: true }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
