
export function DisclaimerBanner({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="border-t border-chalk-800 px-4 py-2 text-center text-xs text-chalk-500">
        Clash Markets is a skill-and-conviction game built on real DreamDEX markets — not
        investment advice, and any squad can lose the funds staked on it.
      </p>
    );
  }

  return (
    <div className="rounded-card border border-chalk-700 bg-pitch-900 p-4 text-xs text-chalk-500">
      <p>
        Clash Markets is non-custodial by design — Clash never holds your funds, and every
        trade your squad makes is a real, direct order on DreamDEX's on-chain order book.
      </p>
      <p className="mt-2">
        This is a skill-and-conviction game, not a financial product. Nothing here is
        investment advice, and every pick carries the same real risk as any DreamDEX trade —
        including losing the entire amount staked on it. Play only with funds you can afford
        to lose.
      </p>
    </div>
  );
}
