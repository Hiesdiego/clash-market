"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "accent" | "secondary" | "outline" | "ghost" | "gain" | "loss" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-pitch-950 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  // Uses the per-league accent CSS variable so one button matches any league.
  primary:
    "bg-accent text-[color:var(--accent-contrast)] shadow-lg shadow-black/20 hover:brightness-110 focus-visible:ring-[color:var(--accent)]",
  accent:
    "bg-accent text-[color:var(--accent-contrast)] shadow-lg shadow-black/20 hover:brightness-110 focus-visible:ring-[color:var(--accent)]",
  secondary:
    "bg-chalk-800 text-chalk-100 hover:bg-chalk-700 focus-visible:ring-chalk-600",
  outline:
    "border border-chalk-700 bg-transparent text-chalk-100 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] focus-visible:ring-[color:var(--accent)]",
  ghost:
    "bg-transparent text-chalk-300 hover:bg-chalk-800/60 hover:text-chalk-100 focus-visible:ring-chalk-600",
  gain: "bg-gain text-pitch-950 shadow-lg shadow-gain/20 hover:brightness-110 focus-visible:ring-gain",
  loss: "bg-loss text-pitch-950 shadow-lg shadow-loss/20 hover:brightness-110 focus-visible:ring-loss",
  danger:
    "border border-loss/40 bg-loss/10 text-loss hover:bg-loss/20 focus-visible:ring-loss",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, leftIcon, rightIcon, fullWidth, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  );
});
