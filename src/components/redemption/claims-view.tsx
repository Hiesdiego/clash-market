"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stat } from "@/components/ui/stat";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ConnectWalletButton } from "@/components/auth/connect-wallet-button";
import { useClaims, positionKey } from "./use-claims";
import { activeChain, formatCollateral } from "@/lib/redemption/claims";



function TxLinks({ hashes }: { hashes: string[] }) {
  if (hashes.length === 0) return null;
  const explorer = activeChain().blockExplorers.default.url;
  return (
    <Card className="border-gain/30">
      <CardBody className="py-4">
        <p className="text-xs uppercase tracking-widest text-gain">Redeemed this session</p>
        <div className="mt-2 space-y-1">
          {hashes.map((hash) => (
            <a
              key={hash}
              href={`${explorer}/tx/${hash}`}
              target="_blank"
              rel="noreferrer"
              className="block font-mono text-xs text-accent underline-offset-4 hover:underline"
            >
              {hash.slice(0, 22)}… ↗
            </a>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

export function ClaimsView() {
  const {
    status,
    positions,
    count,
    totalLabel,
    collateralSymbol,
    walletBalance,
    error,
    redeeming,
    txHashes,
    refresh,
    redeemAllNow,
    redeemOneNow,
  } = useClaims();

  if (status === "unauthenticated") {
    return (
      <EmptyState
        icon="◈"
        title="Connect your wallet to claim"
        description="Your redeemable winnings live on-chain. Connect the wallet you played with to see and redeem them."
        action={<ConnectWalletButton />}
      />
    );
  }

  if (status === "loading" && count === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  if (status === "error" && count === 0) {
    return (
      <EmptyState
        icon="⚠"
        title="Couldn't load your claims"
        description={error ?? "Something went wrong reading redeemable positions."}
        action={
          <Button variant="outline" onClick={refresh}>
            Try again
          </Button>
        }
      />
    );
  }

  const walletLabel = walletBalance === null ? "—" : formatCollateral(walletBalance);

  if (count === 0) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon="✓"
          title="All paid up"
          description="No winnings waiting to be redeemed right now. When a squad or solo pick settles in your favour, it'll show up here to claim."
          action={
            <Link href="/positions">
              <Button variant="outline">View your positions</Button>
            </Link>
          }
        />
        <TxLinks hashes={txHashes} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary + primary action */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Card glow>
          <CardBody className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-3 gap-6">
              <Stat label="To redeem" value={`≈ ${totalLabel}`} sub={collateralSymbol} tone="gain" />
              <Stat label="Positions" value={count} />
              <Stat label="In your wallet" value={walletLabel} sub={collateralSymbol} />
            </div>
            <Button
              variant="gain"
              size="lg"
              loading={redeeming === "all"}
              disabled={redeeming !== null}
              onClick={redeemAllNow}
            >
              Redeem all → your wallet
            </Button>
          </CardBody>
        </Card>
      </motion.div>

      <p className="text-xs text-chalk-500">
        One tap claims every position below in a single transaction. Signing is silent — the collateral lands in your
        connected wallet.
      </p>

      {error && count > 0 && <p className="text-sm text-loss">{error}</p>}

      {/* Per-position list */}
      <div className="space-y-2">
        {positions.map((p, i) => {
          const key = positionKey(p);
          const busy = redeeming !== null;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
            >
              <Card>
                <CardBody className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-chalk-100">
                        {p.asset ?? p.label ?? "Settled market"}
                      </span>
                      <Badge tone={p.kind === "win" ? "gain" : "neutral"}>{p.kind === "win" ? "WIN" : "VOID"}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-chalk-500">
                      {p.side === "up" ? "Up · YES" : "Down · NO"} · {formatCollateral(p.amount)} contracts
                      {p.kind === "void" && " · void refunds half to both sides"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-widest text-chalk-500">Est. payout</p>
                      <p className="font-mono text-sm font-semibold text-gain tabular-nums">
                        ≈ {formatCollateral(p.estPayout)} {collateralSymbol}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={redeeming === key}
                      disabled={busy}
                      onClick={() => redeemOneNow(p)}
                    >
                      Redeem
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <TxLinks hashes={txHashes} />
    </div>
  );
}
