"use client";

import { useEffect, useMemo, useState } from "react";
import { EdgeScorePanel } from "@/components/edge-score/edge-score-panel";
import { WalletPanel } from "@/components/auth/wallet-panel";
import { SessionKeyManager } from "@/components/session-keys/session-key-manager";
import { AccentProvider } from "@/components/ui/accent-provider";
import { Eyebrow } from "@/components/ui/card";
import { Button, Input, Badge } from "@/components/ui";

type Squad = {
  id: string;
  league_type: string;
  status: string;
  total_score: number;
  created_at: string;
  picks?: { outcome: string | null }[];
};
type Profile = { wallet_address: string; display_name: string | null; created_at: string };

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/users/me/profile").then((r) => r.json()),
      fetch("/api/squads/history").then((r) => r.json()),
    ]).then(([profileBody, squadBody]) => {
      setProfile(profileBody.user ?? null);
      setName(profileBody.user?.display_name ?? "");
      setSquads(squadBody.squads ?? []);
    });
  }, []);

  const stats = useMemo(() => {
    const picks = squads.flatMap((s) => s.picks ?? []).filter((p) => p.outcome);
    const wins = picks.filter((p) => p.outcome === "correct").length;
    return {
      rounds: squads.length,
      settled: squads.filter((s) => s.status === "settled").length,
      score: squads.reduce((total, s) => total + Number(s.total_score || 0), 0),
      picks: picks.length,
      wins,
      rate: picks.length ? Math.round((wins / picks.length) * 100) : 0,
    };
  }, [squads]);

  async function saveName() {
    const response = await fetch("/api/users/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: name }),
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error ?? "Could not save name");
      return;
    }
    setProfile(body.user);
    setEditing(false);
    setMessage("Profile updated");
  }

  const shortWallet = profile?.wallet_address
    ? `${profile.wallet_address.slice(0, 6)}…${profile.wallet_address.slice(-4)}`
    : "Wallet not linked";

  const statCards: { label: string; value: string | number; tone: string }[] = [
    { label: "Total score", value: stats.score.toFixed(1), tone: "text-accent" },
    { label: "Rounds played", value: stats.rounds, tone: "text-chalk-100" },
    { label: "Settled squads", value: stats.settled, tone: "text-chalk-100" },
    { label: "Pick accuracy", value: `${stats.rate}%`, tone: "text-gain" },
    { label: "Correct calls", value: `${stats.wins}/${stats.picks}`, tone: "text-chalk-100" },
  ];

  return (
    <AccentProvider league="classic" as="main" className="min-h-screen px-5 py-10 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Player card hero */}
        <section className="floodlight relative overflow-hidden rounded-3xl border border-accent/25 bg-gradient-to-br from-accent/10 via-pitch-900 to-pitch-900 p-7 sm:p-10">
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-7 sm:flex-row sm:items-end">
            <div>
              <Eyebrow>Player profile</Eyebrow>
              <h1 className="mt-3 font-display text-4xl leading-[0.95] text-chalk-100 sm:text-6xl">
                {profile?.display_name || "Your player card"}
              </h1>
              <p className="mt-3 font-mono text-xs text-chalk-500">
                {shortWallet} · Joined{" "}
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
              {editing ? "Close editor" : "Edit profile"}
            </Button>
          </div>

          {editing && (
            <div className="relative mt-6 flex max-w-lg gap-2">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={32}
                placeholder="Username or team name"
                className="flex-1"
              />
              <Button variant="accent" onClick={saveName}>Save</Button>
            </div>
          )}
          {message && <p className="relative mt-3 text-sm text-gain">{message}</p>}
        </section>

        {/* Stat strip */}
        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {statCards.map((s) => (
            <div key={s.label} className="rounded-2xl border border-chalk-800 bg-pitch-900/80 p-5">
              <p className="text-xs uppercase tracking-widest text-chalk-500">{s.label}</p>
              <p className={`mt-3 font-display text-3xl tabular-nums ${s.tone}`}>{s.value}</p>
            </div>
          ))}
        </section>

        {/* One-tap play + wallet */}
        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <SessionKeyManager />
          <WalletPanel />
        </section>

        {/* Edge score */}
        <div className="mt-6">
          <EdgeScorePanel />
        </div>

        {/* Recent form */}
        <section className="mt-8 rounded-2xl border border-chalk-800 bg-pitch-900/80 p-6">
          <div className="flex items-end justify-between">
            <div>
              <Eyebrow>Recent form</Eyebrow>
              <h2 className="mt-1 font-display text-2xl text-chalk-100">Your latest squads</h2>
            </div>
            <a href="/history" className="text-sm font-medium text-accent hover:brightness-110">Full history →</a>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {squads.slice(0, 6).map((s) => (
              <div key={s.id} className="rounded-xl border border-chalk-800 bg-pitch-950 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold capitalize text-chalk-100">{s.league_type}</span>
                  <Badge tone={s.status === "settled" ? "accent" : "muted"}>{s.status}</Badge>
                </div>
                <p className="mt-4 font-display text-2xl tabular-nums text-chalk-100">
                  {Number(s.total_score || 0).toFixed(1)}{" "}
                  <span className="text-xs font-normal text-chalk-500">points</span>
                </p>
                <p className="mt-2 text-xs text-chalk-600">
                  {new Date(s.created_at).toLocaleDateString()} · {s.picks?.length ?? 0} picks
                </p>
              </div>
            ))}
            {squads.length === 0 && (
              <p className="text-sm text-chalk-500">Play your first league round to start building your record.</p>
            )}
          </div>
        </section>
      </div>
    </AccentProvider>
  );
}
