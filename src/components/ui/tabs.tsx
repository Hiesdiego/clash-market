"use client";

import { cn } from "@/lib/cn";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}


export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  size = "md",
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-chalk-800 bg-pitch-950/50 p-1",
        className,
      )}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative rounded-lg font-semibold transition-all duration-200",
              size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
              active
                ? "bg-accent text-[color:var(--accent-contrast)] shadow-sm"
                : "text-chalk-400 hover:text-chalk-100",
            )}
          >
            {item.label}
            {item.count != null && (
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                  active ? "bg-black/20" : "bg-chalk-800 text-chalk-400",
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
