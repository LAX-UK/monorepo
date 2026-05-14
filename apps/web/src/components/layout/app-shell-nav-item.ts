import type { LucideIcon } from "lucide-react";

export type AppShellNavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  match?: (pathname: string) => boolean;
};
