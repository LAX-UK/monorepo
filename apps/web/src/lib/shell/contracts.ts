import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import type { AccountChrome } from "@/lib/navigation/account-switcher-model";
import type { DashboardDensity } from "@/lib/preferences/density";
import type { LaxFamilyLinkVm } from "@auction/lax-ecosystem";
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

/** One block of the client menu: an optional heading and its entries. */
export type NavSection = {
  id: string;
  /** `null` for blocks without a heading (Home, and the account block at the foot). */
  title: string | null;
  items: readonly NavItem[];
};

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
  /** Client menu as sections (Buying, Selling, Organisation); `nav` lists the same entries flat. */
  navSections?: readonly NavSection[];
  /** Client only: the account in use, its switcher and the header strip. */
  clientAccount?: AccountChrome;
  /** Client only: the LAX top bar (other products, LAX Account); staff shells have none. */
  familyLinks?: readonly LaxFamilyLinkVm[];
  pendingSubmissionCount?: number;
  pendingArtistCount?: number;
  navCounts?: AdminNavCounts;
};

export const SHELL_BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;
