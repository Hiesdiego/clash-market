import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";


export async function markExpiredSessionKeys() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("session_keys")
    .update({ status: "expired" })
    .lt("expires_at", new Date().toISOString())
    .eq("status", "active")
    .select("id, user_id");

  if (error) throw error;
  return data;
}

export async function findExpiringSessionKeys(withinHours: number) {
  const admin = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() + withinHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from("session_keys")
    .select("id, user_id, expires_at")
    .eq("status", "active")
    .lt("expires_at", cutoff);

  if (error) throw error;
  return data;
}
