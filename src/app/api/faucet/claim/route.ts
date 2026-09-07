import { NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFaucetAmounts, sendFaucetPayout } from "@/lib/faucet/server";
import { isMainnet } from "@/lib/env";

export const runtime = "nodejs";

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function nextClaimAt() {
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(0, 0, 0, 0);
  return next.toISOString();
}

async function resolveCaller() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data: appUser } = await supabase
    .from("users")
    .select("id, wallet_address")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();
  if (!appUser || !isAddress(appUser.wallet_address)) return null;

  return {
    id: appUser.id,
    walletAddress: getAddress(appUser.wallet_address),
  };
}

export async function POST() {
  if (isMainnet()) {
    return NextResponse.json({ error: "The faucet is available on testnet only" }, { status: 404 });
  }

  const caller = await resolveCaller();
  if (!caller) {
    return NextResponse.json(
      { error: "Connect and link your wallet before claiming faucet funds" },
      { status: 401 },
    );
  }

  const admin = createSupabaseAdminClient();
  const claimDate = todayUtc();
  const { data: existing } = await admin
    .from("faucet_claims")
    .select("id, status, stt_tx_hash, tusdc_tx_hash")
    .eq("user_id", caller.id)
    .eq("claim_date", claimDate)
    .maybeSingle();

  if (existing?.status === "completed") {
    return NextResponse.json({ error: "You have already claimed today", nextClaimAt: nextClaimAt() }, { status: 429 });
  }
  if (existing?.status === "pending") {
    return NextResponse.json({ error: "Your faucet claim is already being processed" }, { status: 409 });
  }
  if (existing?.status === "failed" && (existing.stt_tx_hash || existing.tusdc_tx_hash)) {
    return NextResponse.json(
      { error: "Your claim was partially paid. Please contact support before trying again.", claimId: existing.id },
      { status: 409 },
    );
  }

  const amounts = getFaucetAmounts();
  let claimId = existing?.id;
  if (claimId) {
    const { error } = await admin
      .from("faucet_claims")
      .update({ status: "pending", error_message: null })
      .eq("id", claimId)
      .eq("status", "failed");
    if (error) return NextResponse.json({ error: "Could not start faucet claim" }, { status: 500 });
  } else {
    const { data: claim, error } = await admin
      .from("faucet_claims")
      .insert({
        user_id: caller.id,
        wallet_address: caller.walletAddress,
        claim_date: claimDate,
        stt_amount: Number(amounts.sttLabel),
        tusdc_amount: Number(amounts.tusdcLabel),
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !claim) {
      // A concurrent request won the unique (user_id, claim_date) race.
      return NextResponse.json({ error: "Your faucet claim is already being processed" }, { status: 409 });
    }
    claimId = claim.id;
  }

  try {
    const payout = await sendFaucetPayout(caller.walletAddress, async (kind, hash) => {
      await admin
        .from("faucet_claims")
        .update(kind === "stt" ? { stt_tx_hash: hash } : { tusdc_tx_hash: hash })
        .eq("id", claimId);
    });

    await admin
      .from("faucet_claims")
      .update({
        stt_tx_hash: payout.sttTxHash,
        tusdc_tx_hash: payout.tusdcTxHash,
        status: "completed",
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", claimId);

    return NextResponse.json({
      success: true,
      claimId,
      sttTxHash: payout.sttTxHash,
      tusdcTxHash: payout.tusdcTxHash,
      sttAmount: payout.sttLabel,
      tusdcAmount: payout.tusdcLabel,
      nextClaimAt: nextClaimAt(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Faucet payout failed";
    await admin
      .from("faucet_claims")
      .update({ status: "failed", error_message: message })
      .eq("id", claimId);

    console.error("Faucet payout failed", { claimId, wallet: caller.walletAddress, error });
    return NextResponse.json({ error: message, claimId }, { status: 503 });
  }
}
