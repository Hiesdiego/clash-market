"use client";

import { useState } from "react";
import type { Database } from "@/lib/supabase/database.types";

type Market = Database["public"]["Tables"]["markets"]["Row"];


export function MarketRow({ market }: { market: Market }) {
  const [current, setCurrent] = useState(market);
  const [pending, setPending] = useState(false);

  async function toggle(field: "featured" | "excluded") {
    const secret = window.prompt("Admin secret");
    if (!secret) return;

    setPending(true);
    try {
      const response = await fetch(`/api/admin/markets/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
        body: JSON.stringify({ [field]: !current[field] }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Update failed");
      const { market: updated } = await response.json();
      setCurrent(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <tr className="border-b border-chalk-800">
      <td className="py-2 pr-4 uppercase text-chalk-300">{current.league_type}</td>
      <td className="py-2 pr-4 text-chalk-100">{current.underlying}</td>
      <td className="py-2 pr-4 text-chalk-300">{current.status}</td>
      <td className="py-2 pr-4 tabular-nums text-chalk-300">
        {current.spread !== null ? current.spread.toFixed(4) : "—"}
      </td>
      <td className="py-2 pr-4 text-chalk-500">{new Date(current.expires_at).toLocaleString()}</td>
      <td className="py-2 pr-4">
        <button
          disabled={pending}
          onClick={() => toggle("featured")}
          className={current.featured ? "text-classic" : "text-chalk-500"}
        >
          {current.featured ? "★ Featured" : "☆ Feature"}
        </button>
      </td>
      <td className="py-2 pr-4">
        <button
          disabled={pending}
          onClick={() => toggle("excluded")}
          className={current.excluded ? "text-loss" : "text-chalk-500"}
        >
          {current.excluded ? "Excluded" : "Exclude"}
        </button>
      </td>
    </tr>
  );
}