"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { useAuth } from "@/components/providers/auth-provider";
import { activeCollateral, getWalletBalances } from "@/lib/chains/wallet-balances";
import { Button } from "@/components/ui/button";
import { getPublicEnv } from "@/lib/env";

export function HeaderWalletBalance() {
  const { authenticated, wallet, walletReady } = useAuth();
  const [balance, setBalance] = useState<bigint | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [balanceRefresh, setBalanceRefresh] = useState(0);
  const collateral = activeCollateral();

  useEffect(() => {
    if (!authenticated || !wallet) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { token } = await getWalletBalances(wallet.address as `0x${string}`);
        if (!cancelled) setBalance(token);
      } catch {
        if (!cancelled) setBalance(null);
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 15_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [authenticated, wallet, walletReady, balanceRefresh]);

  if (!authenticated) return null;
  const faucetBotUrl = getPublicEnv().NEXT_PUBLIC_TESTNET_FAUCET_BOT_URL;

  async function claimTokens() {
    setClaiming(true);
    setClaimMessage(null);
    try {
      const response = await fetch("/api/faucet/claim", { method: "POST" });
      const body = (await response.json()) as { error?: string; sttAmount?: string; tusdcAmount?: string };
      if (!response.ok) throw new Error(body.error ?? "Claim failed");
      setClaimMessage(`+${body.sttAmount} STT · +${body.tusdcAmount} ${collateral.symbol}`);
      setBalanceRefresh((value) => value + 1);
    } catch (error) {
      setClaimMessage(error instanceof Error ? error.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  }

  return <div className="relative flex items-center gap-2 rounded-full border border-chalk-700 bg-pitch-900/80 px-3 py-1.5 text-xs">
    <span className="h-1.5 w-1.5 rounded-full bg-gain" />
    <span className="text-chalk-500">Balance</span>
    <span className="font-mono font-semibold text-chalk-100">{!walletReady ? "Loading…" : balance === null ? "Unavailable" : `${Number(formatUnits(balance, collateral.decimals)).toFixed(2)} ${collateral.symbol}`}</span>
    {faucetBotUrl ? <a href={faucetBotUrl} target="_blank" rel="noreferrer" className="ml-1 rounded-full border border-accent/50 px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent/10">Get test tokens</a> : <Button title="Claim 1 STT and 10 tUSDC once per day" size="sm" variant="outline" onClick={claimTokens} loading={claiming} className="ml-1 h-7 rounded-full px-2.5 text-[11px]">Claim</Button>}
    {claimMessage && <span className="absolute right-0 top-10 z-50 max-w-64 rounded-lg border border-chalk-700 bg-pitch-900 px-3 py-2 text-[11px] text-chalk-200 shadow-xl">{claimMessage}</span>}
  </div>;
}
