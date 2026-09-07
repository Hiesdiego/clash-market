"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallets, usePrivy } from "@privy-io/react-auth";
import { getDreamDexBrowserClient, bindSigner } from "@/lib/dreamdex/browser-client";
import { createPrivyWalletClient } from "@/lib/privy/browser-wallet";
import {
  loadClaimable,
  redeemAll as redeemAllPositions,
  redeemOne as redeemOnePosition,
  activeCollateral,
  sumEstPayout,
  formatCollateral,
  type ClaimablePositionView,
} from "@/lib/redemption/claims";



const POLL_MS = 25000;

export type ClaimsStatus = "unauthenticated" | "loading" | "ready" | "error";

/** Stable identity for a position — used for React keys and per-row busy state. */
export function positionKey(p: { marketId: string; outcomeIdx: 0 | 1 }): string {
  return `${p.marketId.toLowerCase()}:${p.outcomeIdx}`;
}

export interface UseClaims {
  status: ClaimsStatus;
  positions: ClaimablePositionView[];
  count: number;
  total: bigint;
  totalLabel: string;
  collateralSymbol: string;
  walletBalance: bigint | null;
  error: string | null;
  /** "all" while a batch redeem is in flight, a positionKey while a single one is, else null. */
  redeeming: string | null;
  txHashes: string[];
  refresh: () => void;
  redeemAllNow: () => Promise<void>;
  redeemOneNow: (position: ClaimablePositionView) => Promise<void>;
}

export function useClaims(): UseClaims {
  const { authenticated, ready } = usePrivy();
  const { wallets } = useWallets();

  const address = (wallets.find((w) => w.walletClientType === "privy")?.address ?? wallets[0]?.address) ?? null;

  const [status, setStatus] = useState<ClaimsStatus>("loading");
  const [positions, setPositions] = useState<ClaimablePositionView[]>([]);
  const [walletBalance, setWalletBalance] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [txHashes, setTxHashes] = useState<string[]>([]);
  const cancelled = useRef(false);

  const load = useCallback(async () => {
    if (!ready) return;
    if (!authenticated || !address) {
      setStatus("unauthenticated");
      setPositions([]);
      setWalletBalance(null);
      return;
    }
    try {
      const exchange = getDreamDexBrowserClient();
      const [claimable, balance] = await Promise.all([
        loadClaimable(exchange, address),
        exchange.client
          .getErc20Balance(activeCollateral().address as `0x${string}`, address as `0x${string}`)
          .catch(() => null),
      ]);
      if (cancelled.current) return;
      setPositions(claimable);
      setWalletBalance(balance);
      setError(null);
      setStatus("ready");
    } catch (err) {
      if (cancelled.current) return;
      setError(err instanceof Error ? err.message : "Couldn't load your claims");
      setStatus("error");
    }
  }, [ready, authenticated, address]);

  useEffect(() => {
    cancelled.current = false;
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      cancelled.current = true;
      window.clearInterval(id);
    };
  }, [load]);

  // Select the signing wallet, put it on Somnia, and bind the sponsored
  // EIP-7702 account as the SDK signer.
  const bindWallet = useCallback(async () => {
    const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
    if (!wallet) throw new Error("No wallet connected. Connect a wallet and try again.");
    const { walletClient } = await createPrivyWalletClient(wallet);
    const exchange = getDreamDexBrowserClient();
    bindSigner(walletClient);
    return exchange;
  }, [wallets]);

  const redeemAllNow = useCallback(async () => {
    if (positions.length === 0 || redeeming !== null) return;
    setRedeeming("all");
    setError(null);
    try {
      const exchange = await bindWallet();
      const result = await redeemAllPositions(exchange, positions);
      if (cancelled.current) return;
      setTxHashes((h) => [result.hash, ...h]);
      setPositions([]); // optimistic; the reload/poll re-confirms against chain state
      await load();
    } catch (err) {
      if (!cancelled.current) setError(err instanceof Error ? err.message : "Redeem failed");
    } finally {
      if (!cancelled.current) setRedeeming(null);
    }
  }, [positions, redeeming, bindWallet, load]);

  const redeemOneNow = useCallback(
    async (position: ClaimablePositionView) => {
      if (redeeming !== null) return;
      const key = positionKey(position);
      setRedeeming(key);
      setError(null);
      try {
        const exchange = await bindWallet();
        const result = await redeemOnePosition(exchange, position);
        if (cancelled.current) return;
        setTxHashes((h) => [result.hash, ...h]);
        setPositions((ps) => ps.filter((p) => positionKey(p) !== key));
        await load();
      } catch (err) {
        if (!cancelled.current) setError(err instanceof Error ? err.message : "Redeem failed");
      } finally {
        if (!cancelled.current) setRedeeming(null);
      }
    },
    [redeeming, bindWallet, load],
  );

  const total = sumEstPayout(positions);

  return {
    status,
    positions,
    count: positions.length,
    total,
    totalLabel: formatCollateral(total),
    collateralSymbol: activeCollateral().symbol,
    walletBalance,
    error,
    redeeming,
    txHashes,
    refresh: load,
    redeemAllNow,
    redeemOneNow,
  };
}
