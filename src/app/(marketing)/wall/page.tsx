import { LiveWall } from "@/components/live-wall/live-wall";

export default function LiveWallPage() {
  return (
    <main className="min-h-screen bg-pitch-950">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <LiveWall />
      </div>
    </main>
  );
}
