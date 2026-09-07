import type { ReactNode } from "react";

export type LeagueType = "blitz" | "classic" | "horizon";


export function AccentProvider({
  league,
  children,
  className,
  as: Tag = "div",
}: {
  league: LeagueType;
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "main" | "article";
}) {
  return (
    <Tag data-accent={league} className={className}>
      {children}
    </Tag>
  );
}
