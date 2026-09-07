import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** A shimmering placeholder block for loading states. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-[pulse-live_2s_ease-in-out_infinite] rounded-lg bg-chalk-800/60",
        className,
      )}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-chalk-800 bg-pitch-900/60 p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="mt-5 h-6 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/2" />
      <Skeleton className="mt-4 h-16 w-full rounded-xl" />
      <Skeleton className="mt-4 h-11 w-full rounded-xl" />
    </div>
  );
}
