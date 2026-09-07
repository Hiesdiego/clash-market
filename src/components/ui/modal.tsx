"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A centered modal dialog with backdrop. Used for the scoring explainer, clan
 * create/join, and confirmations. Closes on Escape and backdrop click.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxWidth = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 animate-[fade-in_0.2s_ease_forwards] bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 w-full animate-[rise-in_0.3s_cubic-bezier(0.22,1,0.36,1)_forwards] rounded-t-3xl border border-chalk-800 bg-pitch-900 shadow-2xl shadow-black/50 sm:rounded-2xl",
          maxWidth,
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-chalk-800 px-6 py-4">
            <h2 className="font-display text-xl text-chalk-100">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-chalk-500 transition-colors hover:bg-chalk-800 hover:text-chalk-100"
            >
              ✕
            </button>
          </div>
        )}
        <div className="max-h-[80vh] overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
