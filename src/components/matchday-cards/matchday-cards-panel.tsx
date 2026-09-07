"use client";

import { useEffect, useState } from "react";
import type { Database } from "@/lib/supabase/database.types";

type MatchdayCard = Database["public"]["Tables"]["matchday_cards"]["Row"] & { squad_id: string | null };


export function MatchdayCardsPanel() {
  const [cards, setCards] = useState<MatchdayCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/matchday-cards/mine")
      .then((r) => r.json())
      .then((body) => (body.error ? setError(body.error) : setCards(body.cards ?? [])));
  }, []);

  async function share(cardId: string) {
    const res = await fetch(`/api/matchday-cards/${cardId}/share`, { method: "POST" });
    const body = await res.json();
    if (!body.error) setCards((c) => c.map((card) => (card.id === cardId ? body.card : card)));
  }

  if (error) return <p className="text-sm text-loss">{error}</p>;
  if (cards.length === 0) return null;

  return (
    <div className="rounded-card border border-chalk-700 bg-pitch-900 p-6">
      <h2 className="font-display text-lg text-chalk-100">Matchday Cards</h2>
      <div className="mt-3 space-y-3">
        {cards.map((card) =>
          card.squad_id ? (
            <div key={card.id} className="flex items-center gap-3">
              <img
                src={`/matchday-card/${card.squad_id}`}
                alt="Matchday Card"
                className="h-20 w-40 rounded-card border border-chalk-800 object-cover"
              />
              <div className="flex-1">
                <p className="text-xs text-chalk-500">{card.league_type}</p>
                {card.shared ? (
                  <p className="text-xs text-gain">Shared</p>
                ) : (
                  <button onClick={() => share(card.id)} className="text-xs text-classic underline">
                    Mark as shared
                  </button>
                )}
              </div>
              <a
                href={`/matchday-card/${card.squad_id}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-card border border-chalk-700 px-3 py-1 text-xs text-chalk-100"
              >
                Open image
              </a>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
