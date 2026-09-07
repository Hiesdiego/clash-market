"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { useClaims } from "./use-claims";


export function RedeemableBanner({ className }: { className?: string }) {
  const { status, count, totalLabel, collateralSymbol, redeeming, redeemAllNow, error } = useClaims();

  if (status === "unauthenticated" || count === 0) return null;

  return (
    <Card glow className={cn("border-gain/40 bg-gain/[0.04]", className)}>
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="gain" dot>
              Redeemable
            </Badge>
            <span className="text-sm font-semibold text-chalk-100">
              {count} winning position{count === 1 ? "" : "s"} · ≈ {totalLabel} {collateralSymbol}
            </span>
          </div>
          <p className="mt-1 text-xs text-chalk-500">
            Settled wins don&apos;t auto-pay — redeem to release the collateral to your wallet.
          </p>
          {error && <p className="mt-1 text-xs text-loss">{error}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="gain"
            size="sm"
            loading={redeeming === "all"}
            disabled={redeeming !== null}
            onClick={redeemAllNow}
          >
            Redeem all
          </Button>
          <Link href="/claim">
            <Button variant="outline" size="sm">
              Open claims →
            </Button>
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
