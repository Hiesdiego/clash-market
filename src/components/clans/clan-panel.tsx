"use client";

import { useCallback, useEffect, useState } from "react";
import { LEAGUE_CONFIG, LEAGUE_TYPES, type LeagueType } from "@/lib/constants/leagues";
import { AccentProvider } from "@/components/ui/accent-provider";
import { Button, Input, Badge } from "@/components/ui";

type MyClan = {
  id: string;
  name: string;
  slug: string;
  league_type: LeagueType;
  join_code: string;
  owner_id: string;
  is_owner: boolean;
  member_count: number;
  registered_at: string | null;
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function ClanPanel() {
  const [clans, setClans] = useState<MyClan[] | null>(null);
  const [name, setName] = useState("");
  const [league, setLeague] = useState<LeagueType>("classic");
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      fetch("/api/clans/mine")
        .then((r) => (r.ok ? r.json() : { clans: [] }))
        .then((b) => setClans(b.clans ?? []))
        .catch(() => setClans([])),
    [],
  );
  useEffect(() => {
    refresh();
  }, [refresh]);

  const ownedCount = (clans ?? []).filter((c) => c.is_owner).length;
  const atClanCap = ownedCount >= 2;

  async function handleCreate() {
    if (!name.trim()) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/clans/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: slugify(name), leagueType: league }),
      });
      const body = await res.json();
      if (body.error) throw new Error(body.error);
      setMessage(`Clan "${body.clan.name}" created. Share your code to recruit members.`);
      setName("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create clan");
    } finally {
      setPending(false);
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/clans/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode }),
      });
      const body = await res.json();
      if (body.error) throw new Error(body.error);
      setMessage(`Joined "${body.clan.name}". Your ${LEAGUE_CONFIG[body.clan.league_type as LeagueType]?.label ?? ""} points now count toward the clan.`);
      setJoinCode("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join clan");
    } finally {
      setPending(false);
    }
  }

  async function handleRegister(clanId: string) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/clans/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clanId }),
      });
      const body = await res.json();
      if (body.error) throw new Error(body.error);
      setMessage("Clan registered — it's now live on the clan leaderboard.");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register clan");
    } finally {
      setPending(false);
    }
  }

  function shareLink(code: string) {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/clans/join/${code}`;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(code);
        setTimeout(() => setCopied((c) => (c === code ? null : c)), 1800);
      },
      () => setError("Couldn't copy — your join code is " + code),
    );
  }

  return (
    <div className="space-y-6">
      {/* Your clans */}
      {clans && clans.length > 0 && (
        <div className="space-y-3">
          {clans.map((c) => {
            const canRegister = c.is_owner && !c.registered_at && c.member_count >= 2;
            const needsMore = c.is_owner && !c.registered_at && c.member_count < 2;
            return (
              <AccentProvider
                key={c.id}
                league={c.league_type}
                as="article"
                className="rounded-2xl border border-accent/25 bg-accent/5 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg text-chalk-100">{c.name}</h3>
                      <Badge tone="accent">{LEAGUE_CONFIG[c.league_type].label}</Badge>
                      {c.registered_at ? (
                        <Badge tone="gain">Registered</Badge>
                      ) : (
                        <Badge tone="muted">Unregistered</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-chalk-500">
                      {c.member_count}/20 members{c.is_owner ? " · you own this clan" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-widest text-chalk-500">Clan tag</p>
                    <p className="font-mono text-lg font-semibold tracking-widest text-accent">{c.join_code}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => shareLink(c.join_code)}>
                    {copied === c.join_code ? "Link copied ✓" : "Copy invite link"}
                  </Button>
                  {canRegister && (
                    <Button size="sm" variant="accent" onClick={() => handleRegister(c.id)} loading={pending}>
                      Register clan
                    </Button>
                  )}
                  {needsMore && (
                    <span className="text-xs text-chalk-500">Recruit 1 more member to register for the leaderboard.</span>
                  )}
                </div>
              </AccentProvider>
            );
          })}
        </div>
      )}

      {/* Create */}
      <div className="rounded-2xl border border-chalk-800 bg-pitch-900/60 p-6">
        <h2 className="font-display text-lg text-chalk-100">Start a clan</h2>
        <p className="mt-1 text-sm text-chalk-500">
          Each clan competes in one league. The clan total is the sum of every member&apos;s points in that league.
        </p>

        {atClanCap ? (
          <p className="mt-4 rounded-xl border border-chalk-800 bg-pitch-950/60 px-4 py-3 text-sm text-chalk-400">
            You already own {ownedCount} clans — the max is 2. Leave or hand one over before starting another.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {LEAGUE_TYPES.map((lt) => (
                <button
                  key={lt}
                  type="button"
                  onClick={() => setLeague(lt)}
                  data-accent={lt}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                    league === lt
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-chalk-800 text-chalk-400 hover:border-chalk-600"
                  }`}
                >
                  {LEAGUE_CONFIG[lt].label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={32}
                placeholder="Clan name (unique, permanent)"
                className="flex-1"
              />
              <Button variant="accent" onClick={handleCreate} loading={pending} disabled={!name.trim()} className="sm:shrink-0">
                Create
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Join */}
      <div className="rounded-2xl border border-chalk-800 bg-pitch-900/60 p-6">
        <h2 className="font-display text-lg text-chalk-100">Join a clan</h2>
        <p className="mt-1 text-sm text-chalk-500">Have an invite code or link? Enter the code to join.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Clan tag / join code"
            className="flex-1 font-mono tracking-widest"
          />
          <Button variant="outline" onClick={handleJoin} loading={pending} disabled={!joinCode.trim()} className="sm:shrink-0">
            Join
          </Button>
        </div>
      </div>

      {message && <p className="text-sm text-gain">{message}</p>}
      {error && <p className="text-sm text-loss">{error}</p>}
    </div>
  );
}
