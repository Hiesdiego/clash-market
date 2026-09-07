"use client";

import { useState } from "react";
import { usePrivy, useSessionSigners, type WalletWithMetadata } from "@privy-io/react-auth";


export function RevokeSessionKeyButton({ sessionKeyId }: { sessionKeyId: string }) {
  const { user } = usePrivy();
  const { removeSessionSigners } = useSessionSigners();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const delegatedWallet = user?.linkedAccounts.find(
    (account): account is WalletWithMetadata => account.type === "wallet" && account.delegated === true
  );

  async function handleRevoke() {
    if (!delegatedWallet) return;
    setPending(true);
    try {
      await removeSessionSigners({ address: delegatedWallet.address });

      const response = await fetch(`/api/session-keys/${sessionKeyId}/revoke`, { method: "POST" });
      if (!response.ok) {
        // Revoked on Privy's side either way — this is a display sync
        // issue, not a security one, so don't block the user on it.
        console.error("Revoked on Privy but failed to update Clash's records");
      }
      setDone(true);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return <p className="text-sm text-gain">Revoked. Clash can no longer trade on your behalf.</p>;
  }

  return (
    <button
      onClick={handleRevoke}
      disabled={!delegatedWallet || pending}
      className="rounded-card border border-loss/40 px-4 py-2 text-sm text-loss disabled:opacity-50"
    >
      {pending ? "Revoking..." : "Revoke trade-only key"}
    </button>
  );
}
