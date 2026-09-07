export interface ArenaMarketMeta {
  label: string;
  tagline: string;
  description: string;
}

const ARENA_ASSETS = new Set(["BOTNAV"]);

export function isArenaMarket(asset: string | null | undefined): boolean {
  if (!asset) return false;
  return ARENA_ASSETS.has(asset.trim().toUpperCase());
}

export function arenaMarketMeta(asset: string | null | undefined): ArenaMarketMeta | null {
  if (!isArenaMarket(asset)) return null;
  return {
    label: "DreamDEX Algo Arena",
    tagline: "Autonomous trading agents · NAV battle",
    description:
      "Powered by DreamDEX's Algo Arena, where autonomous bots run live trading sessions. You're not betting on a coin's price — you're backing whether this agent closes its session with a higher net asset value (NAV) than it opened.",
  };
}
