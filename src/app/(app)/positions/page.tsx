import type { Metadata } from "next";
import { PositionsView } from "@/components/positions/positions-view";
import { RedeemableBanner } from "@/components/redemption/redeemable-banner";
import { AccentProvider } from "@/components/ui/accent-provider";
import { Eyebrow } from "@/components/ui/card";

export const metadata: Metadata = { title: "Positions · Clash Markets" };

export default function PositionsPage() {
  return (
    <AccentProvider league="classic" as="main" className="mx-auto max-w-5xl px-5 py-10 lg:px-8">
      <header className="mb-8">
        <Eyebrow>Your book</Eyebrow>
        <h1 className="mt-2 font-display text-3xl text-chalk-100">Positions</h1>
        <p className="mt-1 text-sm text-chalk-500">
          Open picks live here until their market settles. Settled wins are yours to redeem — claim them to your wallet.
        </p>
      </header>
      {/* Only renders when there's something to claim; contributes no gap otherwise. */}
      <RedeemableBanner className="mb-8" />
      <PositionsView />
    </AccentProvider>
  );
}
