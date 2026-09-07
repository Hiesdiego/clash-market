"use client";

import { useState } from "react";
import { useSigners, usePrivy } from "@privy-io/react-auth";
import { SESSION_KEY_SCOPE, DEFAULT_SESSION_KEY_TTL_DAYS } from "@/lib/session-keys/policy";
import { getPublicEnv } from "@/lib/env";

type Step = "explain" | "granting" | "done" | "error";


export function SessionKeyWizard({ onGranted }: { onGranted?: () => void }) {
  const { user } = usePrivy();
  const { addSigners } = useSigners();
  const [step, setStep] = useState<Step>("explain");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleGrant() {
    setStep("granting");
    try {
      const walletAddress = user?.wallet?.address;
      if (!walletAddress) throw new Error("No embedded wallet found for this session");

      const env = getPublicEnv();

      await addSigners({
        address: walletAddress,
        signers: [
          {
            signerId: env.NEXT_PUBLIC_PRIVY_SIGNER_ID,
            policyIds: [env.NEXT_PUBLIC_PRIVY_TRADE_POLICY_ID, env.NEXT_PUBLIC_PRIVY_REDEEM_POLICY_ID],
          },
        ],
      });

      // Record metadata only — no private key material ever passes
      // through this call or this component. See api/session-keys/route.ts.
      const response = await fetch("/api/session-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicAddress: walletAddress }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Granted on-chain but failed to record metadata");
      }

      setStep("done");
      onGranted?.();
    } catch (err) {
      setStep("error");
      setErrorMessage(err instanceof Error ? err.message : "Could not grant session key");
    }
  }

  return (
    <div className="max-w-md rounded-card border border-chalk-700 bg-pitch-900 p-6">
      <h2 className="font-display text-xl text-chalk-100">Play without signing every pick</h2>
      <p className="mt-2 text-sm text-chalk-300">
        Grant Clash a trade-only key so you don&apos;t need a wallet popup for every
        squad. This key can never move funds out of your wallet.
      </p>

      <div className="mt-4 space-y-2">
        {SESSION_KEY_SCOPE.allowed.map((item) => (
          <div key={item.contract} className="flex items-start gap-2">
            <span className="mt-0.5 text-gain">✓</span>
            <div>
              <p className="text-sm text-chalk-100">{item.label}</p>
              <p className="text-xs text-chalk-500">{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-card border border-loss/40 bg-loss/5 p-3">
        <p className="text-xs uppercase tracking-widest text-loss">Never allowed</p>
        <ul className="mt-1 space-y-1">
          {SESSION_KEY_SCOPE.neverAllowed.map((item) => (
            <li key={item} className="text-xs text-chalk-300">
              {item}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-xs text-chalk-500">
        Expires in {DEFAULT_SESSION_KEY_TTL_DAYS} days, or the moment you revoke it —
        one tap, always available in Settings.
      </p>

      {step === "explain" && (
        <button
          onClick={handleGrant}
          className="mt-5 w-full rounded-card bg-classic py-3 font-display text-pitch-950"
        >
          Grant trade-only key
        </button>
      )}
      {step === "granting" && (
        <p className="mt-5 text-center text-sm text-chalk-500">Requesting approval...</p>
      )}
      {step === "error" && (
        <div className="mt-5">
          <p className="text-sm text-loss">{errorMessage}</p>
          <button
            onClick={handleGrant}
            className="mt-2 w-full rounded-card border border-chalk-700 py-3 font-display text-chalk-100"
          >
            Try again
          </button>
        </div>
      )}
      {step === "done" && (
        <p className="mt-5 text-center text-sm text-gain">Session key active.</p>
      )}
    </div>
  );
}
