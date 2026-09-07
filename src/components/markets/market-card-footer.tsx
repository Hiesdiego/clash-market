"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/providers/auth-provider";
import { getDreamDexBrowserClient, bindSigner } from "@/lib/dreamdex/browser-client";
import { createPrivyWalletClient } from "@/lib/privy/browser-wallet";
import { submitSquadSequential } from "@/lib/squad-builder/submit";
import { projectPayout } from "@/lib/squad-builder/pricing";
import { activeCollateral } from "@/lib/chains/wallet-balances";
import type { MarketCardView } from "@/components/markets/market-card";

const MIN_STAKE_USD = 0.1;
type Direction = "up" | "down";

const TRADE_TIPS = [
  "Placing your bet now",
  "This won't take long",
  "Volatile markets can cause high slippage",
  "Stake responsibly",
  "Claim your winnings from the claims page",
  "Take the Dare, bet where others avoid",
];

function TradeMotionOverlay({ direction }: { direction: Direction }) {
  const arrows = Array.from({ length: 12 });
  const arrow = direction === "up" ? "↑" : "↓";

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden" aria-hidden="true">
      <div className={`trade-motion-glow absolute inset-0 ${direction === "up" ? "bg-gain/10" : "bg-loss/10"}`} />
      <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
        <p className={`rounded-full border px-5 py-2 text-xs font-bold uppercase tracking-[0.35em] backdrop-blur-sm ${direction === "up" ? "border-gain/40 bg-gain/10 text-gain" : "border-loss/40 bg-loss/10 text-loss"}`}>
          {direction === "up" ? "CLASH" : "CRASH"} in motion
        </p>
      </div>
      {arrows.map((_, index) => (
        <span
          key={index}
          className={direction === "up" ? "trade-arrow-up" : "trade-arrow-down"}
          style={{ left: `${6 + ((index * 23) % 88)}%`, animationDelay: `${index * 120}ms` }}
        >
          {arrow}
        </span>
      ))}
    </div>
  );
}

type FooterMarket = MarketCardView;

export function MarketCardFooter({ mode, market, onPick, picked = false, disabled = false }: {
  mode: "trade" | "pick";
  market?: FooterMarket;
  onPick?: (direction: Direction) => void;
  picked?: boolean;
  disabled?: boolean;
}) {
  const [direction, setDirection] = useState<Direction | null>(null);
  const [stake, setStake] = useState("1");
  const [pending, setPending] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tipOrder, setTipOrder] = useState<string[]>(TRADE_TIPS);
  const [tipIndex, setTipIndex] = useState(0);
  const { authenticated, wallet, walletReady, login } = useAuth();
  const collateral = activeCollateral();

  const probability = market?.bestBid != null && market.bestAsk != null ? (market.bestBid + market.bestAsk) / 2 : null;
  const payout = probability != null && direction ? projectPayout(Number(stake), direction === "up" ? probability : 1 - probability).payout : null;

  function requireWallet(action: () => void) {
    if (!authenticated) {
      login();
      return;
    }
    if (!walletReady) {
      setMessage("Your wallet is still loading. Try again in a moment.");
      return;
    }
    action();
  }

  useEffect(() => {
    if (!pending || !direction) return;
    const shuffled = [...TRADE_TIPS];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
    }
    if (payout != null) shuffled.splice(1, 0, `Your estimated winning is $${payout.toFixed(2)}`);
    setTipOrder(shuffled);
    setTipIndex(0);
    const timer = window.setInterval(() => setTipIndex((index) => (index + 1) % shuffled.length), 1600);
    return () => window.clearInterval(timer);
  }, [direction, payout, pending]);

  if (mode === "pick") {
    if (picked) return <p className="flex min-h-14 items-center justify-center rounded-lg border border-accent/40 bg-accent/5 py-2 text-sm text-accent">✓ In your squad</p>;
    return <div className="min-h-14">
      <div className="grid grid-cols-2 gap-2">
        <button disabled={disabled} onClick={() => requireWallet(() => onPick?.("up"))} title="Connect your account to pick" className="rounded-lg border border-gain/40 py-2 text-sm font-semibold text-gain transition hover:bg-gain/10 disabled:opacity-40">CLASH ↑</button>
        <button disabled={disabled} onClick={() => requireWallet(() => onPick?.("down"))} title="Connect your account to pick" className="rounded-lg border border-loss/40 py-2 text-sm font-semibold text-loss transition hover:bg-loss/10 disabled:opacity-40">CRASH ↓</button>
      </div>
      {message && <p className="mt-2 text-center text-[11px] text-loss">{message}</p>}
    </div>;
  }

  async function placeBet() {
    if (!direction || !market) return;
    const stakeUsd = Number(stake);
    if (!authenticated) { login(); return; }
    if (!walletReady) { setMessage("Your wallet is still loading. Try again in a moment."); return; }
    if (!Number.isFinite(stakeUsd) || stakeUsd < MIN_STAKE_USD) { setMessage(`Minimum stake is $${MIN_STAKE_USD.toFixed(2)}`); return; }
    if (!wallet) { setMessage("Connect a wallet first"); return; }
    setPending(true);
    try {
      const { address, walletClient } = await createPrivyWalletClient(wallet);
      bindSigner(walletClient);
      const exchange = getDreamDexBrowserClient();

      // Preflight collateral so a market order can't silently drain the wallet.
      // A binary-market BUY escrows up to ~$1 per share and submit sizes shares
      // as stake / price, so the worst-case lock is ≈ stake / side-probability —
      // which is why a $50 order on a cheap side can take "almost all" of a small
      // balance until the fill settles. Warn before signing instead of surprising.
      const mid = market.bestBid != null && market.bestAsk != null ? (market.bestBid + market.bestAsk) / 2 : 0.5;
      const sideProb = direction === "up" ? mid : 1 - mid;
      const worstCaseUsd = stakeUsd / Math.max(0.05, sideProb);
      try {
        const balance = await exchange.client.getErc20Balance(collateral.address as `0x${string}`, address);
        const needed = BigInt(Math.ceil(worstCaseUsd * 10 ** collateral.decimals));
        if (balance < needed) {
          setMessage(`Not enough ${collateral.symbol}: a $${stakeUsd.toFixed(2)} ${direction === "up" ? "CLASH" : "CRASH"} order can lock up to ~$${worstCaseUsd.toFixed(2)} until it fills.`);
          setPending(false);
          return;
        }
      } catch {
        // Preflight is best-effort; the order itself still guards on-chain.
      }

      const receipts = await submitSquadSequential(
        exchange,
        [{ onchainMarketId: (market.onchainMarketId ?? market.id) as `0x${string}`, direction, isCaptain: false, stakeUsd }],
        undefined,
        {
          // This direct-trade card is already operating on a single selected
          // market. Keep the exchange registry cached between board trades and
          // reuse the book read made by submitSquadSequential; the squad
          // builder keeps its existing forced-refresh/default execution path.
          // The discovery board is polled independently from the browser
          // exchange registry. Refresh here so a market that is live in the
          // board cannot be submitted against a stale registry entry.
          refreshMarkets: true,
          reuseOrderBook: true,
        },
      );
      const receipt = receipts[0];

      // Record the trade as a "solo" position so it shows in /positions. The
      // on-chain trade already succeeded, so a recording failure (e.g. the
      // solo_trades table isn't migrated yet) must NOT surface as a trade error.
      try {
        await fetch("/api/solo-trades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            onchainMarketId: market.onchainMarketId ?? market.id,
            underlying: market.asset,
            question: market.question,
            direction,
            stakeUsd,
            entryImpliedProbability: receipt?.entryImpliedProbability ?? null,
            onchainTxHash: receipt?.transactionHash ?? null,
          }),
        });
      } catch {
        // best-effort recording
      }

      setPlaced(true);
      setDirection(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Trade could not be placed"); }
    finally { setPending(false); }
  }

  if (placed) {
    return <div className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg border border-gain/40 bg-gain/5 py-2 text-center">
      <p className="text-sm font-semibold text-gain">✓ Position taken</p>
      <Link href="/positions" className="text-[11px] text-accent hover:brightness-110">View in your positions →</Link>
    </div>;
  }

  return <div className="relative min-h-14">
    <div className="grid min-h-14 grid-cols-2 gap-2">
      <button disabled={pending} onClick={() => requireWallet(() => { setDirection("up"); setMessage(null); })} title="Connect your account to trade" className="rounded-lg border border-gain/40 py-2 text-sm font-semibold text-gain transition hover:bg-gain/10 disabled:opacity-40">CLASH ↑</button>
      <button disabled={pending} onClick={() => requireWallet(() => { setDirection("down"); setMessage(null); })} title="Connect your account to trade" className="rounded-lg border border-loss/40 py-2 text-sm font-semibold text-loss transition hover:bg-loss/10 disabled:opacity-40">CRASH ↓</button>
    </div>
    {pending && direction && <TradeMotionOverlay direction={direction} />}
    {direction && typeof document !== "undefined" && createPortal(
      <div onClick={() => !pending && setDirection(null)} className="fixed inset-0 z-[100] flex items-center justify-center bg-pitch-950/70 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Place trade">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-chalk-700 bg-pitch-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-widest text-accent">{direction === "up" ? "CLASH" : "CRASH"} stake</p><button disabled={pending} onClick={() => setDirection(null)} className="text-sm text-chalk-500 hover:text-chalk-100 disabled:opacity-30" aria-label="Close">✕</button></div>
        {pending ? (
          <div className="py-8 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-chalk-700 border-t-accent" />
            <p className="mt-5 min-h-6 text-base font-semibold text-chalk-100" key={tipOrder[tipIndex]}>{tipOrder[tipIndex]}</p>
            <p className="mt-2 text-xs text-chalk-500">Waiting for chain confirmation…</p>
            <div className="mx-auto mt-5 flex justify-center gap-1">{tipOrder.map((tip, index) => <span key={tip} className={`h-1.5 w-1.5 rounded-full ${index === tipIndex ? "bg-accent" : "bg-chalk-700"}`} />)}</div>
          </div>
        ) : (
          <>
            <div className="mt-3 flex items-center gap-2"><div className="relative flex-1"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-chalk-500">$</span><input autoFocus type="number" min={MIN_STAKE_USD} step="0.1" value={stake} onChange={(e) => setStake(e.target.value)} className="w-full rounded-lg border border-chalk-700 bg-pitch-950 py-2 pl-6 pr-3 text-sm text-chalk-100 outline-none focus:border-accent" /></div><button onClick={placeBet} disabled={pending} className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-pitch-950 disabled:opacity-50">Place</button></div>
            {payout != null && <p className="mt-2 text-[11px] text-chalk-500">Projected win ${payout.toFixed(2)}</p>}
            {message && <p className="mt-2 text-[11px] text-loss">{message}</p>}
          </>
        )}
      </div>
    </div>,
      document.body
    )}
    {!direction && <p className="mt-2 text-center text-[11px] text-chalk-600">{message ?? "Choose a side to trade"}</p>}
  </div>;
}
