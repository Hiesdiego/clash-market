"use client";

import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { prefix?: ReactNode }>(
  function Input({ className, prefix, ...props }, ref) {
    if (prefix) {
      return (
        <div className={cn(
          "flex items-center gap-1 rounded-xl border border-chalk-700 bg-pitch-950/60 px-3 transition-colors focus-within:border-[color:var(--accent)]",
          className,
        )}>
          <span className="text-sm text-chalk-500">{prefix}</span>
          <input
            ref={ref}
            className="h-11 w-full bg-transparent text-sm text-chalk-100 outline-none placeholder:text-chalk-600 tabular-nums"
            {...props}
          />
        </div>
      );
    }
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border border-chalk-700 bg-pitch-950/60 px-3 text-sm text-chalk-100 outline-none transition-colors placeholder:text-chalk-600 focus:border-[color:var(--accent)]",
          className,
        )}
        {...props}
      />
    );
  },
);
