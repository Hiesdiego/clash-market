"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { getDreamDexBrowserClient, bindSigner } from "@/lib/dreamdex/browser-client";
import { createPrivyWalletClient } from "@/lib/privy/browser-wallet";
import { submitSquadSequential, type SubmissionReceipt } from "@/lib/squad-builder/submit";
import { projectPickOutcomes, projectPayout, type ChipType } from "@/lib/squad-builder/pricing";
import { PICK_LIMITS_BY_LEAGUE, MIN_PICKS_BY_LEAGUE, LEAGUE_CONFIG, type LeagueType } from "@/lib/constants/leagues";
import { activeChain, activeCollateral } from "@/lib/chains/wallet-balances";
import { useAuth } from "@/components/providers/auth-provider";
import type { Database } from "@/lib/supabase/database.types";
import { MarketCard, type MarketCardView } from "@/components/markets/market-card";
import { marketCategory } from "@/lib/markets/category";
import { MarketCardFooter } from "@/components/markets/market-card-footer";
import { ScoringExplainer } from "@/components/leagues/scoring-explainer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Market = Database["public"]["Tables"]["markets"]["Row"];

interface DraftPick {
  market: Market;
  direction: "up" | "down";
  isCaptain: boolean;
  stakeUsd: number;
}

type SubmitPhase = "idle" | "starting" | "sequential" | "finalizing" | "done" | "error";

// Dynamic stakes: a pick starts at $1 and the player edits it freely (equal
// across picks or different per pick). Captain is a POINTS multiplier only —
// never a money multiplier (see the picks map in handleSubmit).
const DEFAULT_STAKE_USD = 1;
const MIN_STAKE_USD = 0.1;
const CHIP_LABELS: Record<ChipType, string> = { triple_captain: "Triple Captain", spotter: "Spotter" };

function toView(market: Market): MarketCardView {
  const snapshot = market.raw_snapshot as { clashOpeningPrice?: number | null; info?: { question?: unknown } } | null;
  const opening = snapshot?.clashOpeningPrice ?? null;
  const rawQuestion = typeof snapshot?.info?.question === "string" ? snapshot.info.question.trim() : "";
  const openingPrice = opening != null && Number.isFinite(Number(opening)) ? Number(opening) : null;
  const category = marketCategory({ asset: market.underlying, openingPrice });
  return {
    id: market.id,
    onchainMarketId: market.onchain_market_id,
    asset: market.underlying,
    question: category === "price"
      ? `${market.underlying} — up or down by expiry?`
      : rawQuestion || `${market.underlying} — up or down by expiry?`,
    windowSeconds: market.window_length_seconds,
    openingPrice,
    spread: market.spread,
    bestBid: market.best_bid,
    bestAsk: market.best_ask,
    expiresAt: market.expires_at,
  };
}

function impliedForSide(market: Market, direction: "up" | "down") {
  const mid = market.best_bid !== null && market.best_ask !== null ? (market.best_bid + market.best_ask) / 2 : 0.5;
  return direction === "up" ? mid : 1 - mid;
}

export function SquadBuilder({ leagueType }: { leagueType: LeagueType }) {
  const { authenticated, wallet, walletReady, login } = useAuth();
  const chain = activeChain();
  const collateral = activeCollateral();

  const [board, setBoard] = useState<Market[]>([]);
  const [fadingMarkets, setFadingMarkets] = useState<Set<string>>(new Set());
  const [boardError, setBoardError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftPick[]>([]);
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<SubmissionReceipt[] | null>(null);
  const [chipType, setChipType] = useState<ChipType | null>(null);
  const [chipRemaining, setChipRemaining] = useState<Record<ChipType, number>>({ triple_captain: 5, spotter: 5 });

  useEffect(() => {
    if (!authenticated) return;
    fetch(`/api/chips/${leagueType}`, { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => {
      if (data) setChipRemaining({ triple_captain: data.triple_captain ?? 0, spotter: data.spotter ?? 0 });
    }).catch(() => undefined);
  }, [authenticated, leagueType]);

  useEffect(() => {
    let cancelled = false;
    const loadBoard = () => fetch(`/api/board/${leagueType}`, { cache: "no-store" })
      .then(async (response) => {
        const contentType = response.headers.get("content-type") ?? "";
        const body = contentType.includes("application/json")
          ? await response.json()
          : null;

        if (!response.ok) {
          throw new Error(
            body?.error ??
              `The market board is unavailable (${response.status}). Restart the development server and try again.`
          );
        }

        if (!body) throw new Error("The market board returned an invalid response.");
        return body;
      })
      .then((data) => {
        if (cancelled) return;
        if (data.error) setBoardError(data.error);
        else setBoard(data.markets ?? []);
      })
      .catch((err) => {
        if (!cancelled) setBoardError(err instanceof Error ? err.message : "Failed to load board");
      });

    loadBoard();
    const refreshId = window.setInterval(loadBoard, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshId);
    };
  }, [leagueType]);

  useEffect(() => {
    const expiryId = window.setInterval(() => {
      const now = Date.now();
      setBoard((current) => {
        const expired = current.filter((market) => new Date(market.expires_at).getTime() <= now).map((market) => market.id);
        if (expired.length) {
          setFadingMarkets((currentFading) => new Set([...currentFading, ...expired]));
          window.setTimeout(() => {
            setBoard((latest) => latest.filter((market) => !expired.includes(market.id)));
            setFadingMarkets((currentFading) => new Set([...currentFading].filter((id) => !expired.includes(id))));
          }, 650);
        }
        return current;
      });
    }, 1000);
    return () => window.clearInterval(expiryId);
  }, []);

  const minPicks = MIN_PICKS_BY_LEAGUE[leagueType];
  const pickLimit = PICK_LIMITS_BY_LEAGUE[leagueType].max;
  const stakesValid = draft.every((p) => Number.isFinite(p.stakeUsd) && p.stakeUsd >= MIN_STAKE_USD);
  const canSubmit = draft.length >= minPicks && draft.length <= pickLimit && draft.some((p) => p.isCaptain) && stakesValid;

  function addPick(market: Market, direction: "up" | "down") {
    if (draft.length >= pickLimit || draft.some((p) => p.market.id === market.id)) return;
    setDraft((d) => [...d, { market, direction, isCaptain: d.length === 0, stakeUsd: DEFAULT_STAKE_USD }]);
  }

  function removePick(marketId: string) {
    setDraft((d) => d.filter((p) => p.market.id !== marketId));
  }

  function setCaptain(marketId: string) {
    setDraft((d) => d.map((p) => ({ ...p, isCaptain: p.market.id === marketId })));
  }

  function setStake(marketId: string, value: string) {
    const parsed = Number(value);
    setDraft((d) => d.map((p) => (p.market.id === marketId ? { ...p, stakeUsd: Number.isFinite(parsed) ? parsed : 0 } : p)));
  }

  async function handleSubmit() {
    setError(null);
    setPhase("starting");

    try {
      // No manual "connect first" dead-end: if the player isn't signed in yet,
      // open the login modal inline and let them come straight back to submit.
      if (!authenticated) {
        setPhase("idle");
        login();
        return;
      }

      if (!walletReady) throw new Error("Your wallet is still loading. Please try again in a moment.");

      const startResponse = await fetch("/api/squads/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueType }),
      });
      const startBody = await startResponse.json();
      if (!startResponse.ok || startBody.error || !startBody.squad) {
        throw new Error(startBody.error ?? `Could not create a squad (${startResponse.status}).`);
      }
      const { squad } = startBody;

      // Pick the wallet we actually sign with, and derive the account from that
      // SAME wallet. The previous version got the provider from wallets[0] but
      // set account: user.wallet.address — a mismatch (and often undefined),
      // and the SDK reads the signer address straight off walletClient.account,
      // so signing broke. Prefer the embedded Privy wallet; fall back to the
      // first connected external wallet.
      if (!wallet) throw new Error("No wallet connected. Connect a wallet and try again.");

      const { address: account, walletClient } = await createPrivyWalletClient(wallet);

      const exchange = getDreamDexBrowserClient();
      bindSigner(walletClient);

      // Captain doubles POINTS (Conviction Scoring), never the stake. Each
      // pick's money is exactly what the player entered — equal across picks or
      // different per pick.
      const picks = draft.map((p) => ({
        onchainMarketId: p.market.onchain_market_id as `0x${string}`,
        direction: p.direction,
          isCaptain: p.isCaptain,
        stakeUsd: p.stakeUsd,
      }));

      // Preflight the collateral every order needs. Sponsorship covers STT gas,
      // but it cannot create the tUSDC balance a market buy escrows.
      const totalStakeUsd = picks.reduce((sum, p) => sum + p.stakeUsd, 0);
      const neededCollateral = BigInt(Math.ceil(totalStakeUsd * 10 ** collateral.decimals));
      const collateralBalance = await exchange.client.getErc20Balance(
        collateral.address as `0x${string}`,
        account
      );
      if (collateralBalance < neededCollateral) {
        throw new Error(
          `Not enough ${collateral.symbol} for collateral — this squad needs ~${totalStakeUsd} ${collateral.symbol}. Fund ${account.slice(0, 6)}…${account.slice(-4)} and retry.`
        );
      }
      let submissionReceipts: SubmissionReceipt[];
      let submittedTxHash: string;

      // Sequential is the sole real submission path — see the top
      // comment in lib/squad-builder/submit.ts for why: true one-tap
      // atomic batching via Privy's client SDK isn't achievable
      // against the currently-installed package (confirmed by
      // inspecting its real shipped types), not a fallback for a
      // working batched path.
      setPhase("sequential");
      submissionReceipts = await submitSquadSequential(exchange, picks, (completed, total) =>
        setProgress({ completed, total })
      );
      const lastReceipt = submissionReceipts[submissionReceipts.length - 1];
      if (!lastReceipt) throw new Error("Submission produced no receipts");
      submittedTxHash = lastReceipt.transactionHash;

      setPhase("finalizing");
      const finalizeResponse = await fetch(`/api/squads/${squad.id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submittedTxHash,
          picks: submissionReceipts.map((r) => ({
            onchainMarketId: r.pick.onchainMarketId,
            direction: r.pick.direction,
            isCaptain: r.pick.isCaptain,
            entryImpliedProbability: r.entryImpliedProbability,
            stakeUsd: r.pick.stakeUsd,
            onchainTxHash: r.transactionHash,
          })),
          chipType,
        }),
      });
      const finalizeBody = await finalizeResponse.json();
      if (!finalizeResponse.ok || finalizeBody.error) {
        throw new Error(finalizeBody.error ?? `Could not record the submitted squad (${finalizeResponse.status}).`);
      }

      setReceipts(submissionReceipts);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setPhase("error");
    }
  }

  if (phase === "done" && receipts) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="relative overflow-hidden rounded-card border border-gain/40 bg-gain/5 p-6"
      >
        <div className="floodlight pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gain">Locked in</p>
          <h2 className="mt-1 font-display text-2xl text-chalk-100">Your squad is live</h2>
          <p className="mt-1 text-sm text-chalk-400">Every pick is on-chain. Points settle the moment each market resolves.</p>
          <ul className="mt-5 space-y-2 text-sm">
            {receipts.map((r) => (
              <li key={r.pick.onchainMarketId} className="flex items-center justify-between rounded-xl border border-chalk-800 bg-pitch-950/60 px-4 py-2.5">
                <span className="flex items-center gap-2 text-chalk-200">
                  <Badge tone={r.pick.direction === "up" ? "gain" : "loss"}>{r.pick.direction === "up" ? "CLASH" : "CRASH"}</Badge>
                  {r.pick.isCaptain && <Badge tone="accent" dot>Captain</Badge>}
                </span>
                <a
                  href={`${chain.blockExplorers.default.url}/tx/${r.transactionHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-accent underline-offset-4 hover:underline"
                >
                  {r.transactionHash.slice(0, 10)}…
                </a>
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl text-chalk-100">{LEAGUE_CONFIG[leagueType].label} board</h1>
          <ScoringExplainer />
        </div>
        {boardError && <p className="mt-2 text-sm text-loss">{boardError}</p>}
        {!boardError && board.length === 0 && (
          <p className="mt-2 text-sm text-chalk-500">
            No markets are open for this league right now. Rounds run on a live clock — fresh markets appear
            the moment the next window opens.
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {board.map((market) => {
            const alreadyPicked = draft.some((p) => p.market.id === market.id);
            const full = draft.length >= pickLimit;
            return (
              <MarketCard
                key={market.id}
                view={toView(market)}
                dimmed={fadingMarkets.has(market.id)}
                footer={<MarketCardFooter mode="pick" market={toView(market)} picked={alreadyPicked} disabled={full} onPick={(direction) => addPick(market, direction)} />}
              />
            );
          })}
        </div>
      </div>

      <aside className="sticky top-20 h-fit rounded-card border border-chalk-800 bg-pitch-900/80 p-4 backdrop-blur">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg text-chalk-100">Your lineup</h2>
          <span className="font-mono text-sm tabular-nums text-chalk-400">
            <span className={draft.length >= minPicks ? "text-accent" : "text-chalk-100"}>{draft.length}</span>
            <span className="text-chalk-600">/{pickLimit}</span>
          </span>
        </div>

        {/* Pick-slot pips: a quick read on how full the lineup is. */}
        <div className="mt-3 flex gap-1.5">
          {Array.from({ length: pickLimit }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i < draft.length ? "bg-accent" : "bg-chalk-800"}`}
            />
          ))}
        </div>

        {draft.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-chalk-800 px-4 py-8 text-center">
            <p className="text-sm text-chalk-400">Your lineup is empty.</p>
            <p className="mt-1 text-xs text-chalk-600">Tap CLASH or CRASH on a market to draft your first pick.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2.5">
            <AnimatePresence initial={false}>
              {draft.map((p) => {
                const forSide = impliedForSide(p.market, p.direction);
                const projected = projectPickOutcomes({ entryImpliedProbability: forSide, isCaptain: p.isCaptain, chipType });
                const money = projectPayout(p.stakeUsd || 0, forSide);
                const stakeOk = Number.isFinite(p.stakeUsd) && p.stakeUsd >= MIN_STAKE_USD;
                return (
                  <motion.li
                    key={p.market.id}
                    layout
                    initial={{ opacity: 0, y: 14, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 28, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className={`relative overflow-hidden rounded-xl border p-3 text-sm transition-colors ${
                      p.isCaptain ? "border-accent/50 bg-accent/5" : "border-chalk-800 bg-pitch-950/40"
                    }`}
                  >
                    {p.isCaptain && (
                      <span
                        className="pointer-events-none absolute inset-x-0 top-0 h-px animate-shine bg-[linear-gradient(90deg,transparent,var(--accent),transparent)] bg-[length:200%_100%]"
                        aria-hidden
                      />
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium text-chalk-100">{p.market.underlying}</span>
                        <Badge tone={p.direction === "up" ? "gain" : "loss"}>{p.direction === "up" ? "CLASH" : "CRASH"}</Badge>
                      </span>
                      <button
                        onClick={() => removePick(p.market.id)}
                        aria-label="Remove pick"
                        className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-chalk-600 transition-colors hover:bg-chalk-800 hover:text-loss"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setCaptain(p.market.id)}
                        className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${p.isCaptain ? "text-accent" : "text-chalk-500 hover:text-chalk-300"}`}
                      >
                        <span aria-hidden>{p.isCaptain ? "★" : "☆"}</span>
                        {p.isCaptain ? "Captain · 2× pts" : "Make Captain"}
                      </button>
                      <div className="relative w-24">
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-chalk-500">$</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={MIN_STAKE_USD}
                          step="0.1"
                          value={p.stakeUsd}
                          onChange={(event) => setStake(p.market.id, event.target.value)}
                          className={`w-full rounded-lg border bg-pitch-950 py-1.5 pl-5 pr-2 text-sm text-chalk-100 outline-none focus:border-accent ${stakeOk ? "border-chalk-800" : "border-loss"}`}
                          aria-label="Stake in USD"
                        />
                      </div>
                    </div>

                    <p className="mt-2 text-xs text-chalk-500">
                      If right <span className="font-semibold text-accent">+{projected.ifCorrect.toFixed(1)} pts</span> · win{" "}
                      <span className="font-semibold text-gain">${money.payout.toFixed(2)}</span>
                    </p>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}

        {draft.length > 0 &&
          (() => {
            const totalStake = draft.reduce((sum, p) => sum + (Number.isFinite(p.stakeUsd) ? p.stakeUsd : 0), 0);
            const totalWin = draft.reduce(
              (sum, p) => sum + projectPayout(p.stakeUsd || 0, impliedForSide(p.market, p.direction)).payout,
              0
            );
            return (
              <div className="mt-3 flex items-center justify-between rounded-xl border border-accent/20 bg-accent/5 px-3 py-2.5 text-xs">
                <span className="text-chalk-400">
                  Total stake <span className="font-semibold text-chalk-100 tabular-nums">${totalStake.toFixed(2)}</span>
                </span>
                <span className="text-chalk-400">
                  If all hit <span className="font-semibold text-gain tabular-nums">${totalWin.toFixed(2)}</span>
                </span>
              </div>
            );
          })()}

        <div className="mt-4 rounded-xl border border-chalk-800 bg-pitch-950/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-chalk-400">Chips</span>
            {chipType && <button onClick={() => setChipType(null)} className="text-xs text-chalk-500 hover:text-chalk-200">Clear</button>}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(Object.keys(CHIP_LABELS) as ChipType[]).map((chip) => {
              const available = chipRemaining[chip] > 0;
              return <button key={chip} disabled={!available} onClick={() => setChipType(chipType === chip ? null : chip)} className={`rounded-lg border px-2 py-2 text-left text-xs transition-colors ${chipType === chip ? "border-accent bg-accent/10 text-accent" : available ? "border-chalk-700 text-chalk-300 hover:border-accent/60" : "border-chalk-800 text-chalk-600"}`}>
                <span className="block font-semibold">{CHIP_LABELS[chip]}</span>
                <span className="mt-0.5 block">{chip === "triple_captain" ? "Captain scores 3×" : "4× on winning odds &gt; 3"} · {chipRemaining[chip]} left</span>
              </button>;
            })}
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || (phase !== "idle" && phase !== "error")}
          loading={phase !== "idle" && phase !== "error"}
          fullWidth
          size="lg"
          className="mt-4 font-display"
        >
          {phase === "idle" || phase === "error"
            ? draft.length < minPicks
              ? `Add ${minPicks - draft.length} more to submit`
              : "Submit squad"
            : "Submitting…"}
        </Button>

        {/* Live submission progress — a filling bar reads better than a line of text. */}
        {phase === "sequential" && progress && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-chalk-400">
              <span>Confirming picks</span>
              <span className="font-mono tabular-nums">{progress.completed}/{progress.total}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-chalk-800">
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${(progress.completed / Math.max(1, progress.total)) * 100}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 30 }}
              />
            </div>
          </div>
        )}

        <p className="mt-3 text-xs text-chalk-500">
          Pick {minPicks === pickLimit ? pickLimit : `${minPicks}–${pickLimit}`}, flag a Captain for 2× points, and set any stake (min ${MIN_STAKE_USD.toFixed(2)} each). Winnings pay out to your wallet.
        </p>
        {error && <p className="mt-2 text-xs text-loss">{error}</p>}
      </aside>
    </div>
  );
}
