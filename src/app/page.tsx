import { MarketTradingBoard } from "@/components/markets/market-trading-board";
import { AccentProvider } from "@/components/ui/accent-provider";

export default function HomePage() {
  // Home is league-agnostic; it wears the flagship (Classic) accent so the
  // accent utilities render a real colour rather than the bare :root default.
  return (
    <AccentProvider league="classic">
      <MarketTradingBoard />
    </AccentProvider>
  );
}
