import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names with correct conflict resolution.
 * The single class-composition helper used by every UI primitive and screen —
 * `clsx` for conditional composition, `tailwind-merge` so later utilities win
 * over earlier ones (e.g. `cn("px-4", condition && "px-6")` yields `px-6`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
