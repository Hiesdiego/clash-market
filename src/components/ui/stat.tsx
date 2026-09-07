import type { ReactNode } from "react";
import { cn } from "@/lib/cn";


export function Stat({
  label,
  value,
  sub,
  tone = "default",
  className,
  align = "left",
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "accent" | "gain" | "loss";
  className?: string;
  align?: "left" | "center" | "right";
}) {
  const valueTone = {
    default: "text-chalk-100",
    accent: "text-[color:var(--accent)]",
    gain: "text-gain",
    loss: "text-loss",
  }[tone];

  return (
    <div className={cn(align === "center" && "text-center", align === "right" && "text-right", className)}>
      <p className="text-xs uppercase tracking-wider text-chalk-500">{label}</p>
      <p className={cn("mt-1 font-display text-2xl leading-none tabular-nums", valueTone)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-chalk-500">{sub}</p>}
    </div>
  );
}
