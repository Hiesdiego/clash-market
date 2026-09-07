"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionKeyStatus } from "@/lib/supabase/database.types";
import { SessionKeyWizard } from "./session-key-wizard";
import { RevokeSessionKeyButton } from "./revoke-session-key-button";
import { Badge, Skeleton } from "@/components/ui";


type SessionKey = {
  id: string;
  public_address: string;
  status: SessionKeyStatus;
  expires_at: string;
  created_at: string;
};

function daysUntil(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export function SessionKeyManager() {
  const [keys, setKeys] = useState<SessionKey[] | null>(null);

  const refresh = useCallback(
    () =>
      fetch("/api/session-keys")
        .then((r) => (r.ok ? r.json() : { sessionKeys: [] }))
        .then((body) => setKeys(body.sessionKeys ?? []))
        .catch(() => setKeys([])),
    [],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (keys === null) return <Skeleton className="h-48 w-full max-w-md" />;

  const active = keys.find((k) => k.status === "active" && new Date(k.expires_at).getTime() > Date.now());

  if (!active) return <SessionKeyWizard onGranted={refresh} />;

  const remaining = daysUntil(active.expires_at);

  return (
    <div className="max-w-md rounded-card border border-chalk-800 bg-pitch-900/60 p-6">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-xl text-chalk-100">One-tap play</h2>
        <Badge tone="gain" dot>On</Badge>
      </div>
      <p className="mt-2 text-sm text-chalk-400">
        Squads submit without a wallet popup on every pick. This key can never move funds out of your wallet.
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs uppercase tracking-widest text-chalk-500">Expires in</dt>
          <dd className="mt-1 font-display text-2xl tabular-nums text-chalk-100">
            {remaining} <span className="text-sm font-normal text-chalk-500">day{remaining === 1 ? "" : "s"}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-widest text-chalk-500">Signer</dt>
          <dd className="mt-1 font-mono text-sm text-chalk-300">
            {active.public_address.slice(0, 6)}…{active.public_address.slice(-4)}
          </dd>
        </div>
      </dl>

      <div className="mt-5 border-t border-chalk-800 pt-4">
        <RevokeSessionKeyButton sessionKeyId={active.id} />
      </div>
    </div>
  );
}
