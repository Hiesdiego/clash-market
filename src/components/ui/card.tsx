import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The one surface primitive. Every panel, tile, and list row in the app is a
 * Card so elevation, radius, and border read identically everywhere.
 */
export function Card({
  className,
  interactive = false,
  glow = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean; glow?: boolean }) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-chalk-800 bg-pitch-900/80 shadow-xl shadow-black/20",
        interactive &&
          "transition-all duration-300 hover:-translate-y-0.5 hover:border-[color:var(--accent)]/50 hover:shadow-[color:var(--accent)]/5",
        glow && "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[color:var(--accent)]/60 before:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-start justify-between gap-3 p-5 pb-0", className)} {...props} />;
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

/** An uppercase, tracked-out eyebrow label — the app's section-header idiom. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("text-xs font-semibold uppercase tracking-[0.2em] text-chalk-500", className)}>
      {children}
    </span>
  );
}
