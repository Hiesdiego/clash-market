"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";
import { AccentProvider } from "@/components/ui/accent-provider";
import { LEAGUE_CONFIG, type LeagueType } from "@/lib/constants/leagues";

export default function JoinClanPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toString().toUpperCase();
  const [state, setState] = useState<"joining" | "done" | "error">("joining");
  const [clanName, setClanName] = useState<string | null>(null);
  const [leagueType, setLeagueType] = useState<LeagueType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const join = useCallback(async () => {
    setState("joining");
    setError(null);
    try {
      const res = await fetch("/api/clans/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode: code }),
      });
      const body = await res.json();
      if (!res.ok || body.error) throw new Error(body.error ?? "Couldn't join this clan");
      setClanName(body.clan?.name ?? null);
      setLeagueType((body.clan?.league_type as LeagueType) ?? null);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join this clan");
      setState("error");
    }
  }, [code]);

  useEffect(() => {
    if (code) join();
  }, [code, join]);

  return (
    <AccentProvider league={leagueType ?? "classic"} as="main" className="grid min-h-screen place-items-center px-5">
      <div className="w-full max-w-md rounded-3xl border border-chalk-800 bg-pitch-900/60 p-8 text-center">
        <p className="font-mono text-2xl font-semibold tracking-[0.3em] text-accent">{code || "—"}</p>

        {state === "joining" && <p className="mt-6 text-sm text-chalk-400">Joining clan…</p>}

        {state === "done" && (
          <>
            <h1 className="mt-6 font-display text-3xl text-chalk-100">You&apos;re in{clanName ? `, welcome to ${clanName}` : ""}</h1>
            <p className="mt-2 text-sm text-chalk-500">
              {leagueType
                ? `Your ${LEAGUE_CONFIG[leagueType].label} points now count toward the clan total.`
                : "Your points now count toward the clan total."}
            </p>
            <div className="mt-6 flex justify-center gap-2">
              {leagueType && (
                <Link
                  href={`/play/${leagueType}`}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-[color:var(--accent-contrast)] shadow-lg shadow-black/20 transition hover:brightness-110"
                >
                  Play {LEAGUE_CONFIG[leagueType].label}
                </Link>
              )}
              <Link
                href="/clans"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-chalk-700 px-5 text-sm font-semibold text-chalk-100 transition hover:border-accent hover:text-accent"
              >
                View clans
              </Link>
            </div>
          </>
        )}

        {state === "error" && (
          <>
            <h1 className="mt-6 font-display text-2xl text-chalk-100">Couldn&apos;t join</h1>
            <p className="mt-2 text-sm text-loss">{error}</p>
            <p className="mt-2 text-xs text-chalk-500">
              If you just opened the app, give it a moment to sign you in, then try again.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button variant="accent" onClick={join}>Try again</Button>
              <Link
                href="/clans"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-chalk-700 px-5 text-sm font-semibold text-chalk-100 transition hover:border-accent hover:text-accent"
              >
                Go to clans
              </Link>
            </div>
          </>
        )}
      </div>
    </AccentProvider>
  );
}
