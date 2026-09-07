import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";


export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const env = getEnv();
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.ADMIN_API_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { featured, excluded } = body as { featured?: boolean; excluded?: boolean };

  if (featured === undefined && excluded === undefined) {
    return NextResponse.json({ error: "Provide featured and/or excluded" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("markets")
    .update({ ...(featured !== undefined && { featured }), ...(excluded !== undefined && { excluded }) })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ market: data });
}