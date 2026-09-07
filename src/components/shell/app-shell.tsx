"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { ConnectWalletButton } from "@/components/auth/connect-wallet-button";
import { SettlementNotifications } from "@/components/notifications/settlement-notifications";
import { ClaimIndicator } from "@/components/redemption/claim-indicator";
import { HeaderWalletBalance } from "@/components/auth/header-wallet-balance";



type NavItem = { href: string; label: string; icon: (active: boolean) => React.ReactNode };

const NAV: NavItem[] = [
  {
    href: "/",
    label: "Play",
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 1.9}>
        <path d="m5 3 14 9-14 9V3Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/leagues",
    label: "Leagues",
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 1.9}>
        <path d="M8 21h8m-4-4v4m7-17H5v5a7 7 0 0 0 14 0V4Zm0 2h3v2a4 4 0 0 1-4 4M5 6H2v2a4 4 0 0 0 4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/clans",
    label: "Clans",
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 1.9}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/positions",
    label: "Positions",
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 1.9}>
        <path d="M3 3v18h18M7 15l4-4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 1.9}>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";

  return (
    <div className="min-h-screen bg-pitch-950 text-chalk-100">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-chalk-800/70 bg-pitch-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-5 sm:py-3.5 lg:px-8">
          <div className="flex min-w-0 items-center gap-4 sm:gap-8">
            <Link
              href="/"
              aria-label="Clash Markets home"
              className="flex shrink-0 items-center gap-2 font-display text-lg tracking-tight text-chalk-100 sm:text-xl"
            >
              <Image
                src="/assets/logo/cm-logo.png"
                alt=""
                width={32}
                height={32}
                priority
                className="h-8 w-8 object-contain"
              />
              <span>Clash<span className="text-accent">.</span></span>
            </Link>
            <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
              {NAV.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      active ? "bg-chalk-800/60 text-chalk-100" : "text-chalk-400 hover:text-chalk-100"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
            <div className="hidden sm:block"><ClaimIndicator /></div>
            <div className="hidden sm:block"><HeaderWalletBalance /></div>
            <SettlementNotifications />
            <ConnectWalletButton />
          </div>
        </div>
      </header>

      {/* Page content — bottom padding leaves room for the mobile tab bar */}
      <div className="pb-20 md:pb-0">{children}</div>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-chalk-800/70 bg-pitch-950/90 backdrop-blur-md md:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-accent" : "text-chalk-500"
                )}
              >
                {item.icon(active)}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
