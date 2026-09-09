/**
 * The real production home for everything Phase 3/5's Next.js trigger
 * routes could only approximate: a genuinely always-on Node process,
 * deployed to Render as a dedicated web service (per the deployment
 * blueprint and the worker's HTTP health endpoint). The process is
 * the Phase 5 discussion of why Next.js serverless functions are the
 * wrong primitive for this).
 *
 * Deliberately in THIS repo, not a separate package — it imports the
 * exact same lib/ functions the Next.js routes call
 * (syncMarketsForLeague, settlePicksForLeague, etc.), so there is only
 * ever one implementation of "what a sync/settlement run does." This
 * file is just a scheduler + health reporter around that shared logic.
 * Deployed as a second Render web service pointing at this same repo,
 * with `tsx worker/index.ts` as its start command instead of
 * `next start`. Render requires web services to bind to an HTTP port, so
 * this worker exposes a lightweight `/health` endpoint in addition to its
 * scheduled jobs.
 */

import { createServer } from "node:http";
import { syncAllMarkets } from "../src/lib/dreamdex/sync";
import { runSettlementSweep } from "../src/lib/scoring/run-settlement-sweep";
import { reconcileStuckMarkets } from "../src/lib/scoring/reconcile-stuck-markets";
import { settleSoloTrades } from "../src/lib/scoring/settle-solo-trades";
import { createSupabaseAdminClient } from "../src/lib/supabase/admin";
import { LEAGUE_TYPES, type LeagueType } from "../src/lib/constants/leagues";
import { alert } from "./alert";

// Cadence per league, matching each league's real round timing
// (rounds.ts) rather than one interval for everyone — Blitz needs to
// notice a resolution within its 15-minute window, Horizon does not.
const SETTLEMENT_INTERVAL_MS: Record<LeagueType, number> = {
  blitz: 60_000,
  classic: 2 * 60_000,
  horizon: 10 * 60_000,
};
const SOLO_SETTLEMENT_INTERVAL_MS = 60_000;
const ALL_MARKETS_SYNC_INTERVAL_MS = 60_000;
// The on-chain reconcile is a backstop for the indexer, not the primary path —
// run it on a calmer cadence than the per-league sweeps.
const RECONCILE_INTERVAL_MS = 5 * 60_000;

const healthServer = createServer((request, response) => {
  if (request.url !== "/health") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ status: "ok" }));
});

async function reportHealth(jobName: string, run: () => Promise<unknown>) {
  const admin = createSupabaseAdminClient();
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();

  try {
    const result = await run();
    console.log(`[worker] ${jobName} succeeded in ${Date.now() - startedMs}ms`, result);
    await admin.from("worker_health").upsert({
      job_name: jobName,
      last_run_at: startedAt,
      last_success_at: startedAt,
      last_error: null,
      consecutive_failures: 0,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] ${jobName} failed:`, message);

    const { data: existing } = await admin
      .from("worker_health")
      .select("consecutive_failures")
      .eq("job_name", jobName)
      .single();
    const consecutiveFailures = (existing?.consecutive_failures ?? 0) + 1;

    await admin.from("worker_health").upsert({
      job_name: jobName,
      last_run_at: startedAt,
      last_error: message,
      consecutive_failures: consecutiveFailures,
      updated_at: new Date().toISOString(),
    });

    // Alert on the first failure and then every 5th, rather than every
    // single one — a transient blip shouldn't page anyone, a real
    // outage should not go silent either.
    if (consecutiveFailures === 1 || consecutiveFailures % 5 === 0) {
      await alert(`${jobName} failed (${consecutiveFailures}x in a row): ${message}`);
    }
  }
}

function scheduleLeagueJobs() {
  const runAllMarketsSync = () =>
    reportHealth("sync-all-markets", () => syncAllMarkets());
  runAllMarketsSync();
  setInterval(runAllMarketsSync, ALL_MARKETS_SYNC_INTERVAL_MS);

  // Comprehensive on-chain backstop (gotcha #1 — the indexer lags): reconcile
  // any market that has settled on-chain but is still non-terminal in our DB,
  // scope "all" so it also covers uncurated / solo markets (league_type = null)
  // that the per-league sweeps never touch. Reads void-vs-resolved straight
  // from chain; the per-league settlement + solo jobs then score the picks and
  // trades on the rows it fixes.
  const runReconcile = () =>
    reportHealth("reconcile-stuck-markets", () => reconcileStuckMarkets("all"));
  runReconcile();
  setInterval(runReconcile, RECONCILE_INTERVAL_MS);

  for (const league of LEAGUE_TYPES) {
    const runSettlement = () =>
      reportHealth(`settlement-${league}`, async () => {
        await runSettlementSweep(league);
      });

    runSettlement();
    setInterval(runSettlement, SETTLEMENT_INTERVAL_MS[league]);
  }

  // Solo trades are not league-scoped. Run one dedicated sweep instead of
  // attaching the same work to all three league timers.
  const runSoloSettlement = () =>
    reportHealth("settlement-solo", () => settleSoloTrades());
  runSoloSettlement();
  setInterval(runSoloSettlement, SOLO_SETTLEMENT_INTERVAL_MS);
}

console.log("[worker] Clash Markets background worker starting...");
const port = Number(process.env.PORT ?? 10000);
healthServer.listen(port, "0.0.0.0", () => {
  console.log(`[worker] Health server listening on port ${port}`);
});
scheduleLeagueJobs();


process.on("SIGTERM", () => {
  console.log("[worker] SIGTERM received, shutting down");
  healthServer.close();
  process.exit(0);
});
