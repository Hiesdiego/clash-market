import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { MarketRow } from "./market-row";


export default async function AdminMarketsPage() {
  const admin = createSupabaseAdminClient();
  const { data: markets, error } = await admin
    .from("markets")
    .select("*")
    .order("league_type", { ascending: true })
    .order("expires_at", { ascending: true })
    .limit(200);

  if (error) {
    return <main className="p-8 text-loss">Failed to load markets: {error.message}</main>;
  }

  return (
    <main className="p-8">
      <h1 className="font-display text-2xl text-chalk-100">Market curation</h1>
      <p className="mt-1 text-sm text-chalk-500">
        {markets?.length ?? 0} markets synced. Exclude any market that shouldn&apos;t be
        pickable, regardless of what sync reports.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-chalk-700 text-chalk-500">
              <th className="py-2 pr-4">League</th>
              <th className="py-2 pr-4">Underlying</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Spread</th>
              <th className="py-2 pr-4">Expires</th>
              <th className="py-2 pr-4">Featured</th>
              <th className="py-2 pr-4">Excluded</th>
            </tr>
          </thead>
          <tbody>
            {markets?.map((market) => (
              <MarketRow key={market.id} market={market} />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}