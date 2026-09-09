"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LEAGUE_CONFIG, LEAGUE_TYPES, type LeagueType } from "@/lib/constants/leagues";
import { AccentProvider } from "@/components/ui/accent-provider";
import { Button, Input, Badge } from "@/components/ui";

type MyClan = {
  id: string; name: string; slug: string; join_code: string; owner_id: string;
  is_owner: boolean; member_count: number; registered_leagues: LeagueType[];
};
type ClanMember = {
  user_id: string; display_name: string | null; wallet_address: string;
  role: "owner" | "member"; is_active: boolean;
};
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function ClanPanel({ initialClans }: { initialClans: MyClan[] }) {
  const router = useRouter();
  const [clans, setClans] = useState<MyClan[]>(initialClans);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [newOwnerId, setNewOwnerId] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/clans/mine");
      const body = response.ok ? await response.json() : { clans: [] };
      setClans(body.clans ?? []);
      router.refresh();
    } catch { setClans([]); }
  }, [router]);

  useEffect(() => {
    const clan = clans[0];
    if (!clan?.is_owner) { setMembers([]); return; }
    fetch(`/api/clans/members?clanId=${encodeURIComponent(clan.id)}`)
      .then((response) => (response.ok ? response.json() : { members: [] }))
      .then((body) => setMembers(body.members ?? []))
      .catch(() => setMembers([]));
  }, [clans]);

  async function request(path: string, body: Record<string, string>) {
    setPending(true); setError(null); setMessage(null);
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error ?? "Request failed");
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      return null;
    } finally { setPending(false); }
  }

  async function handleCreate() {
    if (!name.trim()) return;
    const result = await request("/api/clans/create", { name: name.trim(), slug: slugify(name) });
    if (result) { setMessage(`Clan "${result.clan.name}" created. Share your code to recruit members.`); setName(""); await refresh(); }
  }
  async function handleJoin() {
    if (!joinCode.trim()) return;
    const result = await request("/api/clans/join", { joinCode: joinCode.trim() });
    if (result) { setMessage(`Joined "${result.clan.name}". Your registered league points now count toward the clan.`); setJoinCode(""); await refresh(); }
  }
  async function handleRegister(clanId: string, leagueType: LeagueType) {
    const result = await request("/api/clans/register", { clanId, leagueType });
    if (result) { setMessage(`${LEAGUE_CONFIG[leagueType].label} registration is live for the clan.`); await refresh(); }
  }
  async function handleLeave(clanId: string) {
    if (!window.confirm("Leave this clan? Your points already contributed to it will remain on its table.")) return;
    const result = await request("/api/clans/leave", { clanId });
    if (result) { setMessage("You left the clan. Your contributed points remain with it."); await refresh(); }
  }
  async function handleTransfer(clanId: string) {
    if (!newOwnerId) return;
    const result = await request("/api/clans/transfer", { clanId, newOwnerId });
    if (result) { setMessage("Clan ownership transferred."); setNewOwnerId(""); await refresh(); }
  }
  function shareLink(code: string) {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/clans/join/${code}`;
    navigator.clipboard?.writeText(url).then(
      () => { setCopied(code); setTimeout(() => setCopied((current) => current === code ? null : current), 1800); },
      () => setError(`Couldn't copy — your join code is ${code}`),
    );
  }

  const clan = clans[0];
  const transferableMembers = members.filter((member) => member.is_active && member.role !== "owner");

  return (
    <div className="space-y-6">
      {clan && <AccentProvider league="classic" as="article" className="rounded-2xl border border-accent/25 bg-accent/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-display text-lg text-chalk-100">{clan.name}</h3><Badge tone="gain">{clan.member_count}/20 members</Badge></div><p className="mt-1 text-xs text-chalk-500">{clan.is_owner ? "You own this clan" : "You are a member"}</p></div>
          <div className="text-right"><p className="text-[10px] uppercase tracking-widest text-chalk-500">Clan tag</p><p className="font-mono text-lg font-semibold tracking-widest text-accent">{clan.join_code}</p></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" onClick={() => shareLink(clan.join_code)}>{copied === clan.join_code ? "Link copied ✓" : "Copy invite link"}</Button>{!clan.is_owner && <Button size="sm" variant="danger" onClick={() => handleLeave(clan.id)} loading={pending}>Leave clan</Button>}</div>
        <div className="mt-5 border-t border-chalk-800/70 pt-4"><p className="text-xs uppercase tracking-widest text-chalk-500">Registered leagues</p><div className="mt-2 flex flex-wrap gap-2">
          {LEAGUE_TYPES.map((leagueType) => { const registered = clan.registered_leagues.includes(leagueType); return <span key={leagueType} className="inline-flex items-center gap-2"><Badge tone={registered ? "gain" : "muted"}>{LEAGUE_CONFIG[leagueType].label}{registered ? " · Live" : ""}</Badge>{clan.is_owner && !registered && <Button size="sm" variant="outline" onClick={() => handleRegister(clan.id, leagueType)} loading={pending}>Register</Button>}</span>; })}
        </div>{clan.is_owner && clan.member_count < 2 && <p className="mt-2 text-xs text-chalk-500">Recruit one more member before registering a league.</p>}</div>
        {clan.is_owner && transferableMembers.length > 0 && <div className="mt-5 border-t border-chalk-800/70 pt-4"><p className="text-xs uppercase tracking-widest text-chalk-500">Transfer ownership</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><select value={newOwnerId} onChange={(event) => setNewOwnerId(event.target.value)} className="h-9 min-w-0 flex-1 rounded-xl border border-chalk-700 bg-pitch-950 px-3 text-sm text-chalk-200"><option value="">Choose a clan member</option>{transferableMembers.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name ?? member.wallet_address}</option>)}</select><Button size="sm" variant="outline" onClick={() => handleTransfer(clan.id)} disabled={!newOwnerId} loading={pending}>Transfer</Button></div><p className="mt-2 text-xs text-chalk-500">Owners must transfer ownership before they can leave.</p></div>}
      </AccentProvider>}

      {!clan && <><div className="rounded-2xl border border-chalk-800 bg-pitch-900/60 p-6"><h2 className="font-display text-lg text-chalk-100">Start a clan</h2><p className="mt-1 text-sm text-chalk-500">Create one private clan, then register it for Blitz, Classic, Horizon, or all three.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Input value={name} onChange={(event) => setName(event.target.value)} maxLength={32} placeholder="Clan name (unique, permanent)" className="flex-1" /><Button variant="accent" onClick={handleCreate} loading={pending} disabled={!name.trim()} className="sm:shrink-0">Create</Button></div></div><div className="rounded-2xl border border-chalk-800 bg-pitch-900/60 p-6"><h2 className="font-display text-lg text-chalk-100">Join a clan</h2><p className="mt-1 text-sm text-chalk-500">Have an invite code or link? Enter the code to join.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="Clan tag / join code" className="flex-1 font-mono tracking-widest" /><Button variant="outline" onClick={handleJoin} loading={pending} disabled={!joinCode.trim()} className="sm:shrink-0">Join</Button></div></div></>}
      {message && <p className="text-sm text-gain">{message}</p>}{error && <p className="text-sm text-loss">{error}</p>}
    </div>
  );
}
