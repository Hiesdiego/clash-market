"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";


export function ShareButtons({ path, text, className }: { path: string; text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const absolute = () => (typeof window !== "undefined" ? window.location.origin + path : path);

  async function copy() {
    try {
      await navigator.clipboard.writeText(absolute());
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyError(true);
      setTimeout(() => setCopyError(false), 2500);
    }
  }

  const url = absolute();
  const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  const mail = `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(`${text}\n${url}`)}`;
  const cls =
    "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-chalk-700 text-chalk-300 transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <button type="button" onClick={copy} className={cls} aria-label="Copy link" title="Copy link">
        <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
        </svg>
      </button>
      <a href={x} target="_blank" rel="noreferrer" className={cls} aria-label="Share on X" title="Share on X">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817-5.963 6.817H1.681l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
        </svg>
      </a>
      <a href={mail} className={cls} aria-label="Share by email" title="Share by email">
        <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
      <span className="sr-only" aria-live="polite">{copied ? "Link copied to your clipboard." : copyError ? "Link could not be copied." : ""}</span>
    </div>
  );
}
