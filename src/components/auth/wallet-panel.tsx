"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { useAuth } from "@/components/providers/auth-provider";
import { activeChain, activeCollateral, getWalletBalances } from "@/lib/chains/wallet-balances";

type Balances = { native: bigint | null; collateral: bigint | null };

export function WalletPanel() {
  const { authenticated, wallet, walletReady } = useAuth();
  const [address, setAddress] = useState<string | null>(null);
  const [balances, setBalances] = useState<Balances>({ native: null, collateral: null });
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chain = activeChain();
  const collateral = activeCollateral();

  useEffect(() => {
    if (!authenticated || !wallet) return;
    const account = wallet.address as `0x${string}`;
    setAddress(account);
    let cancelled = false;
    void getWalletBalances(account).then(({ native, token }) => {
      if (!cancelled) setBalances({ native, collateral: token });
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load balances");
    });
    return () => { cancelled = true; };
  }, [authenticated, wallet, walletReady]);

  async function copyAddress() {
    if (!address) return;
    try { await navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* Clipboard unavailable. */ }
  }

  if (!authenticated) return <div className="rounded-xl border border-chalk-800 bg-chalk-900/50 p-5"><p className="text-sm text-chalk-500">Connect your wallet to see your address and balances.</p></div>;

  return <div className="rounded-xl border border-chalk-800 bg-chalk-900/50 p-5">
    <h2 className="font-display text-lg text-chalk-100">Wallet</h2>
    <div className="mt-4"><p className="text-xs uppercase tracking-wide text-chalk-500">Address</p>{address ? <button type="button" onClick={copyAddress} className="mt-1 flex items-center gap-2 font-mono text-sm text-chalk-200 hover:text-chalk-100" title="Click to copy"><span className="break-all">{address}</span><span className="shrink-0 text-xs text-chalk-500">{copied ? "Copied ✓" : "Copy"}</span></button> : <p className="mt-1 text-sm text-chalk-500">Loading…</p>}</div>
    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className="rounded-lg bg-chalk-900 p-3"><p className="text-xs uppercase tracking-wide text-chalk-500">{chain.nativeCurrency.symbol}</p><p className="mt-1 font-mono text-sm text-chalk-100">{balances.native === null ? "…" : `${formatUnits(balances.native, chain.nativeCurrency.decimals)} ${chain.nativeCurrency.symbol}`}</p></div>
      <div className="rounded-lg bg-chalk-900 p-3"><p className="text-xs uppercase tracking-wide text-chalk-500">{collateral.symbol}</p><p className="mt-1 font-mono text-sm text-chalk-100">{balances.collateral === null ? "…" : `${formatUnits(balances.collateral, collateral.decimals)} ${collateral.symbol}`}</p></div>
    </div>
    {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
  </div>;
}
