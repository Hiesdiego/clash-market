"use client";

import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MarketCountdown } from "@/components/markets/market-countdown";

/**
 * The single market-card shell, shared by every surface that shows markets —
 * the home discovery board and each league's Squad Builder board — so the cards
 * are visually identical everywhere (the ask in the 5-part request: "the cards
 * in the leagues play should be same as the all-market (home)").
 *
 * It is purely presentational: it renders the chrome (Live dot, countdown,
 * question, opening/call price, and — when the caller
 * has order-book data — spread and best bid/ask) and drops the caller's own
 * actions into `footer`. The home board passes a stake input + CLASH/CRASH bet
 * buttons; the Squad Builder passes its add-to-squad buttons. Neither owns the
 * look.
 */
export interface MarketCardView {
  id: string;
  onchainMarketId?: string | null;
  asset: string;
  question: string;
  /** "fixed-strike" markets resolve against a set strike; everything else is an
   *  opening-price "up or down by expiry" market. Defaults to up-down when absent. */
  kind?: "up-down" | "fixed-strike";
  strikePrice?: number | null;
  windowSeconds?: number | null;
  openingPrice?: number | null;
  spread?: number | null;
  bestBid?: number | null;
  bestAsk?: number | null;
  expiresAt?: string | null;
}

const ASSET_META: Record<string, { name: string; logo: string }> = {
  BTC: { name: "Bitcoin", logo: "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png" },
  ETH: { name: "Ethereum", logo: "https://coin-images.coingecko.com/coins/images/279/large/ethereum.png" },
  SOL: { name: "Solana", logo: "https://coin-images.coingecko.com/coins/images/4128/large/solana.png" },
  BNB: { name: "BNB", logo: "https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png" },
  XRP: { name: "XRP", logo: "https://coin-images.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png" },
  DOGE: { name: "Dogecoin", logo: "https://coin-images.coingecko.com/coins/images/5/large/dogecoin.png" },
};

function assetKey(asset: string): string {
  const normalized = asset.toUpperCase();
  return Object.keys(ASSET_META).find((key) => normalized.includes(key)) ?? "";
}

export function assetDisplayName(asset: string): string {
  return ASSET_META[assetKey(asset)]?.name ?? (asset.replace(/[-_]/g, " ").trim() || "asset");
}

function windowSlug(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return "market";
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

export function marketPath(view: MarketCardView): string {
  const asset = assetDisplayName(view.asset).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const type = view.kind === "fixed-strike" ? "above-strike" : "up-down";
  return `/markets/${asset}-${type}-${windowSlug(view.windowSeconds)}-${view.id.slice(-8)}`;
}

export function AssetLogo({ asset, size = "md" }: { asset: string; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false);
  const meta = ASSET_META[assetKey(asset)];
  const dimensions = size === "sm" ? "h-8 w-8" : "h-11 w-11";

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full border border-chalk-700 bg-chalk-950 ${dimensions}`}>
      {meta && !failed ? (
        <img
          src={meta.logo}
          alt={`${meta.name} logo`}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-xs font-bold text-accent">
          {assetDisplayName(asset).slice(0, 3).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function formatWindow(seconds?: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  if (seconds % 3600 === 0) return `${seconds / 3600}h window`;
  if (seconds % 60 === 0) return `${seconds / 60}m window`;
  return `${seconds}s window`;
}

function formatPrice(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: value < 1 ? 4 : 2 })}`;
}

export function MarketCard({
  view,
  live = true,
  dimmed = false,
  footer,
  href,
  className = "",
}: {
  view: MarketCardView;
  live?: boolean;
  dimmed?: boolean;
  footer?: ReactNode;
  href?: string;
  className?: string;
}) {
  const router = useRouter();
  const windowLabel = formatWindow(view.windowSeconds);
  const assetName = assetDisplayName(view.asset);
  // A fixed-strike market ("Will ETH be above $X at expiry?") settles against a
  // set strike and has no opening/call price, so show the strike instead — the
  // reference line every trader on that card actually needs.
  const isFixedStrike = view.kind === "fixed-strike";
  const referenceLabel = isFixedStrike ? "Strike price" : "Opening / call price";
  const referenceValue = isFixedStrike ? view.strikePrice : view.openingPrice;
  const marketQuestion = isFixedStrike
    ? `Will ${assetName} settle above ${formatPrice(view.strikePrice)} at expiry?`
    : `Will ${assetName} finish higher at expiry?`;
  // Bid/ask on a binary market ARE the implied probability of "Up", so we show
  // them as decimal odds (1 / probability) — punchier and more familiar than a
  // raw 0–1 price. (#6: real-time bid/ask movement → decimal odds.)
  const mid = view.bestBid != null && view.bestAsk != null ? (view.bestBid + view.bestAsk) / 2 : null;
  const upOdds = mid != null && mid > 0 && mid < 1 ? 1 / mid : null;
  const downOdds = mid != null && mid > 0 && mid < 1 ? 1 / (1 - mid) : null;

  function openDetails() {
    if (href) router.push(href);
  }

  function handleCardClick(event: MouseEvent<HTMLElement>) {
    if (!href) return;
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, textarea, select, [role=button]")) return;
    openDetails();
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!href || (event.key !== "Enter" && event.key !== " ")) return;
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, textarea, select, [role=button]")) return;
    event.preventDefault();
    openDetails();
  }

  return (
    <article
      className={`group relative flex min-h-[410px] flex-col overflow-hidden rounded-2xl border border-chalk-800 bg-pitch-900/90 p-5 shadow-xl shadow-black/10 transition-all duration-500 hover:-translate-y-1 hover:border-accent/50 hover:shadow-accent/5 sm:min-h-[438px] ${href ? "cursor-pointer" : ""} ${dimmed ? "pointer-events-none translate-y-2 scale-95 opacity-0" : "opacity-100"} ${className}`}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      onMouseDown={(event) => {
        if (!href) return;
        const target = event.target as HTMLElement;
        if (!target.closest("a, button, input, textarea, select, [role=button]")) event.currentTarget.focus();
      }}
      tabIndex={href ? 0 : undefined}
      role={href ? "link" : undefined}
      aria-label={href ? `View ${assetName} market details` : undefined}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent opacity-0 transition group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <AssetLogo asset={view.asset} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-chalk-500">{live ? "Live market" : "Settled market"}</p>
            <p className="mt-1 text-sm font-semibold text-chalk-200">{assetName} price direction</p>
          </div>
        </div>
        {view.expiresAt && <MarketCountdown expiresAt={view.expiresAt} />}
      </div>

      {href ? (
        <Link href={href} className="mt-5 block">
          <h3 className="text-lg font-semibold leading-snug text-chalk-100 transition-colors hover:text-accent">{marketQuestion}</h3>
          <p className="sr-only">{assetName} · Binary{windowLabel ? ` · ${windowLabel}` : ""}. {marketQuestion}</p>
          <p className="mt-2 text-xs text-chalk-500">Resolves at market expiry against the reference price.</p>
        </Link>
      ) : (
        <>
          <h3 className="mt-5 text-lg font-semibold leading-snug text-chalk-100">{marketQuestion}</h3>
          <p className="sr-only">{assetName} · Binary{windowLabel ? ` · ${windowLabel}` : ""}. {marketQuestion}</p>
          <p className="mt-2 text-xs text-chalk-500">Resolves at market expiry against the reference price.</p>
        </>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-chalk-950 p-3 text-sm">
        <div>
          <p className="text-xs text-chalk-500">{referenceLabel}</p>
          <p className="mt-1 font-semibold text-accent">{formatPrice(referenceValue)}</p>
        </div>
        <div>
          <p className="text-xs text-chalk-500">Spread</p>
          <p className="mt-1 font-semibold text-chalk-200">
            {view.spread != null ? `${(view.spread * 100).toFixed(1)}%` : "—"}
          </p>
        </div>
        {mid != null && (
          <div className="col-span-2 grid grid-cols-2 gap-3 border-t border-chalk-800 pt-3">
            <div>
              <p className="text-xs text-chalk-500">CLASH · decimal odds</p>
              <p className="mt-1 font-mono text-base font-semibold text-gain">
                {upOdds != null ? upOdds.toFixed(2) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-chalk-500">CRASH · decimal odds</p>
              <p className="mt-1 font-mono text-base font-semibold text-loss">
                {downOdds != null ? downOdds.toFixed(2) : "—"}
              </p>
            </div>
          </div>
        )}
      </div>

      {footer && <div className="mt-4">{footer}</div>}
    </article>
  );
}
