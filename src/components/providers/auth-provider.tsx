"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePrivy, useWallets, type ConnectedWallet } from "@privy-io/react-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";



export interface AppUser {
  id: string;
  wallet_address: string | null;
  display_name: string | null;
}

interface AuthContextValue {
  ready: boolean;
  walletReady: boolean;
  authenticated: boolean;
  linking: boolean;
  appUser: AppUser | null;
  isNewUser: boolean;
  /** The wallet that signs orders — the embedded Privy wallet if present. */
  wallet: ConnectedWallet | null;
  /** Opens the Privy login modal; linking runs automatically afterwards. */
  login: () => void;
  logout: () => Promise<void>;
  /** Re-fetch the linked app user (e.g. after setting a display name). */
  refresh: () => Promise<void>;
  clearNewUser: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, getAccessToken, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [linking, setLinking] = useState(false);
  // Guards against re-linking on every render; reset when auth drops so a
  // fresh login re-links.
  const linkedRef = useRef(false);

  const wallet = wallets.find((w) => w.walletClientType === "privy" || w.walletClientType === "privy-v2") ?? wallets[0] ?? null;
  const walletReady = ready && wallet !== null;

  const link = useCallback(async () => {
    if (linkedRef.current || linking) return;
    setLinking(true);
    try {
      const supabase = createSupabaseBrowserClient();

      // A Supabase session must exist before /api/auth/link-wallet, which reads
      // the caller's own session to know which auth.uid() to attach the wallet
      // to. Reuse an existing anon session rather than minting a new one.
      const { data: existing } = await supabase.auth.getSession();
      if (!existing.session) {
        const { error: anonError } = await supabase.auth.signInAnonymously();
        // Anonymous sign-ins may be disabled on the project; degrade quietly —
        // the user can still browse, and actions will re-prompt login.
        if (anonError) return;
      }

      const token = await getAccessToken();
      if (!token) return;

      const ref = new URLSearchParams(window.location.search).get("ref");
      const url = ref ? `/api/auth/link-wallet?ref=${encodeURIComponent(ref)}` : "/api/auth/link-wallet";
      const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;

      const body = (await res.json()) as { user: AppUser; isNewUser: boolean };
      setAppUser(body.user);
      setIsNewUser(body.isNewUser);
      linkedRef.current = true;
    } finally {
      setLinking(false);
    }
  }, [getAccessToken, linking]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return;
      const body = (await res.json()) as { user: AppUser | null };
      if (body.user) setAppUser(body.user);
    } catch {
      // Non-fatal: keep whatever we already have.
    }
  }, []);

  // Silent auto-connect: link as soon as Privy is authenticated on load.
  useEffect(() => {
    if (ready && authenticated) {
      void link();
    }
    if (ready && !authenticated) {
      linkedRef.current = false;
      setAppUser(null);
      setIsNewUser(false);
    }
  }, [ready, authenticated, link]);

  return (
    <AuthContext.Provider
      value={{
        ready,
        walletReady,
        authenticated,
        linking,
        appUser,
        isNewUser,
        wallet,
        login,
        logout,
        refresh,
        clearNewUser: () => setIsNewUser(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
