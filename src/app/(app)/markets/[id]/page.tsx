import { MarketDetail } from "@/components/markets/market-detail";


export default async function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-5xl px-5 py-8 lg:px-8">
      <MarketDetail marketId={decodeURIComponent(id)} />
    </main>
  );
}
