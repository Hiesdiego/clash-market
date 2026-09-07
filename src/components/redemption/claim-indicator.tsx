"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useClaims } from "@/components/redemption/use-claims";


export function ClaimIndicator() {
  const { status, count, totalLabel, collateralSymbol, redeeming, redeemAllNow } = useClaims();
  const pathname = usePathname();

  if (status !== "ready" || count === 0 || pathname === "/claim") return null;

  return (
    <>
    <button
      type="button"
      onClick={redeemAllNow}
      aria-label={`${count} redeemable position${count === 1 ? "" : "s"} worth about ${totalLabel} ${collateralSymbol} — claim`}
      title="Claim your winnings"
      disabled={redeeming !== null}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border border-gain/40 bg-gain/10 px-3 py-1.5",
        "text-sm font-semibold text-gain transition hover:bg-gain/20 disabled:cursor-wait disabled:opacity-80",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_8px] shadow-gain", redeeming === "all" ? "animate-ping" : "animate-[pulse-live_2s_ease-in-out_infinite]")} />
      <span className="tabular-nums">
        ≈ {totalLabel} {collateralSymbol}
      </span>
      <span className="hidden text-gain/70 sm:inline">{redeeming === "all" ? "Claiming…" : "Claim"}</span>
    </button>
    {redeeming === "all" && (
      <div className="fixed inset-x-0 top-[4.5rem] z-50 flex justify-center px-4" role="status" aria-live="polite">
        <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-gain/40 bg-pitch-900/95 p-4 shadow-2xl shadow-gain/10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gain/30 border-t-gain animate-spin" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-chalk-100">Claim in progress</p>
              <p className="mt-0.5 text-xs text-chalk-500">Confirming your winnings on-chain…</p>
            </div>
          </div>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-chalk-800">
            <div className="h-full w-1/2 animate-[claim-progress_1.4s_ease-in-out_infinite] rounded-full bg-gain" />
          </div>
        </div>
      </div>
    )}
    </>
  );
}
