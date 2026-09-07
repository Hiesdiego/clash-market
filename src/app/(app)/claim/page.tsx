import type { Metadata } from "next";
import { AccentProvider } from "@/components/ui/accent-provider";
import { Eyebrow } from "@/components/ui/card";
import { ClaimsView } from "@/components/redemption/claims-view";

export const metadata: Metadata = { title: "Claim · Clash Markets" };


export default function ClaimPage() {
  return (
    <AccentProvider league="classic" as="main" className="mx-auto max-w-4xl px-5 py-10 lg:px-8">
      <header className="mb-8">
        <Eyebrow>Winnings</Eyebrow>
        <h1 className="mt-2 font-display text-3xl text-chalk-100">Claim your winnings</h1>
        <p className="mt-1 text-sm text-chalk-500">
          Settled wins don&apos;t pay out automatically — redeem them to release the collateral to your wallet. One tap
          claims every position at once.
        </p>
      </header>
      <ClaimsView />
    </AccentProvider>
  );
}
