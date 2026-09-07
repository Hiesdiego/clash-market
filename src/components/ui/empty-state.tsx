import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A confident, on-brand empty state. Replaces the terse dev-flavoured
 * "No squads yet." strings scattered through the app.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-chalk-800 bg-pitch-900/40 px-6 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-chalk-800 bg-pitch-950 text-2xl text-[color:var(--accent)]">
          {icon}
        </div>
      )}
      <h3 className="font-display text-xl text-chalk-100">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-chalk-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
