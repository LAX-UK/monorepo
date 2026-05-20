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
  badge?: number;
  badgeTone?: NavBadgeTone;
  match?: (pathname: string) => boolean;
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
    leftSlot?: ReactNode;
    rightSlot?: ReactNode;
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
};

export const SHELL_BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;
