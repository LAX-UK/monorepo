import type { ActingContext } from "@/lib/auth/capabilities";
import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import type { DashboardDensity } from "@/lib/preferences/density";
import type { CapabilityRequirement } from "@auction/types";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type NavBadgeTone = "default" | "warning" | "danger" | "live";

/** Leaf navigation entry — client and staff nav satisfy this contract (Liskov). */
export type NavItem = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  /** One short word for the narrow mobile tab bar; the full label stays the accessible name. */
  shortLabel?: string;
  badge?: number;
  badgeTone?: NavBadgeTone;
  match?: (pathname: string) => boolean;
  /** Leaves Bid for another LAX product (LAX Account), so it opens as a plain link. */
  external?: true;
  requirement?: CapabilityRequirement;
};

export type NavGroup = {
  id: string;
  title: string;
  icon: LucideIcon;
  items: readonly NavItem[];
};

export type NavEntry = NavItem | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

export type ShellRole = "client" | "platform" | "finance";

/** Programmable shell contract — dependency inversion for AppShell. */
export type ShellConfig = {
  role: ShellRole;
  nav: readonly NavEntry[];
  mobileNav: readonly NavItem[];
  moreSheetNav?: readonly NavEntry[];
  header: {
    /** Module actions (notification bell, badges) — rendered before theme toggle. */
    actionsSlot?: ReactNode;
    /** Rare trailing overrides after actions, before theme toggle. */
    extraSlot?: ReactNode;
  };
  footerCluster?: ReactNode;
  contextBanner?: ReactNode;
  topSlot?: ReactNode;
  density?: DashboardDensity;
  hideEmailStatusBanner?: boolean;
  /** When true, the mobile bottom tab bar is not rendered (e.g. focused wizard flows). */
  hideBottomTabBar?: boolean;
  clientWorkspaceMode?: "buying" | "selling";
  pendingSubmissionCount?: number;
  pendingArtistCount?: number;
  navCounts?: AdminNavCounts;
  /** Client dashboard mobile header: which organisation, if any, the person is acting for. */
  mobileHeader?: { actingContext: ActingContext };
};

export const SHELL_BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;
