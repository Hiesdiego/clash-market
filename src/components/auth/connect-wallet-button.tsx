"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { getPublicEnv } from "@/lib/env";

/**
 * Sign-in entry point. Connection itself is now automatic — AuthProvider
 * silently links the wallet to a Supabase session whenever Privy restores a
 * session on load. This button only handles the *first* login (opening the
 * Privy modal) and the one-time display-name prompt for brand-new players.
 */
export function ConnectWalletButton() {
  const { ready, authenticated, linking, appUser, isNewUser, wallet, login, logout, refresh, clearNewUser } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const walletMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!walletMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (walletMenuRef.current && !walletMenuRef.current.contains(event.target as Node)) setWalletMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWalletMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [walletMenuOpen]);

  async function copyWalletAddress() {
    if (!wallet?.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy the wallet address");
    }
  }

  async function claimTokens() {
    setClaiming(true);
    setClaimMessage(null);
    try {
      const response = await fetch("/api/faucet/claim", { method: "POST" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Claim failed");
      setClaimMessage("Test tokens claimed");
    } catch (error) {
      setClaimMessage(error instanceof Error ? error.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  }

  async function signOut() {
    setWalletMenuOpen(false);
    await logout();
  }

  async function saveName() {
    setSavingName(true);
    setError(null);
    try {
      const res = await fetch("/api/users/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save name");
      clearNewUser();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save name");
    } finally {
      setSavingName(false);
    }
  }

  if (authenticated) {
    return (
      <div ref={walletMenuRef} className="relative">
        <button
          type="button"
          onClick={() => setWalletMenuOpen((open) => !open)}
          aria-expanded={walletMenuOpen}
          aria-haspopup="menu"
          className="flex max-w-[11rem] items-center gap-2 rounded-xl border border-chalk-800 bg-pitch-900/60 px-2.5 py-2 text-sm transition hover:border-chalk-600 sm:max-w-[14rem] sm:px-3"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-gain shadow-[0_0_8px] shadow-gain" />
          <span className="min-w-0 truncate text-chalk-200">
            {appUser?.display_name ?? (linking ? "Connecting…" : "Connected")}
          </span>
          <svg aria-hidden="true" className={`h-4 w-4 shrink-0 text-chalk-500 transition-transform ${walletMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
          </svg>
        </button>

        {walletMenuOpen && wallet && !isNewUser && (
          <div
            role="menu"
            aria-label="Wallet menu"
            className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-chalk-700 bg-pitch-900 p-4 text-left shadow-2xl shadow-black/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Wallet</p>
                <p className="mt-1 text-sm font-semibold text-chalk-100">Connected account</p>
              </div>
              <span className="rounded-full bg-gain/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gain">Live</span>
            </div>

            <div className="mt-4 rounded-xl border border-chalk-800 bg-pitch-950/70 p-3">
              <p className="text-[10px] uppercase tracking-widest text-chalk-500">Wallet address</p>
              <p className="mt-2 select-all break-all font-mono text-xs leading-5 text-chalk-200">{wallet.address}</p>
              <button
                type="button"
                role="menuitem"
                onClick={copyWalletAddress}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent/20"
              >
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeLinecap="round" />
                </svg>
                {copied ? "Address copied" : "Copy address"}
              </button>
            </div>

            {getPublicEnv().NEXT_PUBLIC_TESTNET_FAUCET_BOT_URL ? (
              <a
                href={getPublicEnv().NEXT_PUBLIC_TESTNET_FAUCET_BOT_URL}
                target="_blank"
                rel="noreferrer"
                role="menuitem"
                className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-accent/50 px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent/10"
              >
                Get test tokens
              </a>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={claimTokens}
                disabled={claiming}
                className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-accent/50 px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent/10 disabled:cursor-wait disabled:opacity-60"
              >
                {claiming ? "Claiming…" : "Claim test tokens"}
              </button>
            )}
            {claimMessage && <p className="mt-2 text-center text-[11px] text-chalk-300">{claimMessage}</p>}

            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="mt-3 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-chalk-400 transition hover:bg-chalk-800/50 hover:text-chalk-100"
            >
              Sign out
            </button>
          </div>
        )}

        {isNewUser && (
          <div className="absolute right-0 top-[calc(100%+0.75rem)] z-40 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-[color:var(--accent)]/40 bg-pitch-900 p-5 text-left shadow-2xl">
            <p className="text-xs uppercase tracking-widest text-[color:var(--accent)]">Welcome to Clash</p>
            <h2 className="mt-2 font-display text-xl text-chalk-100">Choose your player name</h2>
            <p className="mt-2 text-xs leading-5 text-chalk-400">
              This is how you&apos;ll appear on league tables.
            </p>
            <input
              autoFocus
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={32}
              placeholder="e.g. The Market Makers"
              className="mt-4 w-full rounded-lg border border-chalk-700 bg-pitch-950 px-3 py-2.5 text-sm text-chalk-100 outline-none focus:border-[color:var(--accent)]"
            />
            <Button
              onClick={saveName}
              disabled={savingName || displayName.trim().length < 2}
              loading={savingName}
              fullWidth
              className="mt-3"
            >
              Set player name
            </Button>
            {error && <p className="mt-2 text-sm text-loss">{error}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <Button onClick={login} disabled={!ready} loading={!ready}>
      Sign in
    </Button>
  );
}
