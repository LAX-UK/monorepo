import type { LucideIcon } from "lucide-react";

import type { NavBadgeTone } from "@/lib/shell/contracts";

export type AppShellNavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** One short word for the narrow mobile tab bar; the full label stays the accessible name. */
  shortLabel?: string;
  badge?: number;
  badgeTone?: NavBadgeTone;
  match?: (pathname: string) => boolean;
  /** Leaves Bid for another LAX product (LAX Account), so it opens as a plain link. */
  external?: true;
};
