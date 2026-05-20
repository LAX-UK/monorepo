import type { LucideIcon } from "lucide-react";

import type { NavBadgeTone } from "@/lib/shell/contracts";

export type AppShellNavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  badgeTone?: NavBadgeTone;
  match?: (pathname: string) => boolean;
};
