import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "gain" | "loss" | "live" | "muted";

const tones: Record<Tone, string> = {
  neutral: "border-chalk-700 bg-chalk-800/50 text-chalk-200",
  accent: "border-[color:var(--accent)]/40 bg-[color:var(--accent)]/10 text-[color:var(--accent)]",
  gain: "border-gain/40 bg-gain/10 text-gain",
  loss: "border-loss/40 bg-loss/10 text-loss",
  live: "border-gain/40 bg-gain/10 text-gain",
  muted: "border-chalk-800 bg-transparent text-chalk-500",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  dot = false,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full bg-current",
            tone === "live" && "shadow-[0_0_8px] shadow-gain animate-[pulse-live_2s_ease-in-out_infinite]",
          )}
        />
      )}
      {children}
    </span>
  );
}
