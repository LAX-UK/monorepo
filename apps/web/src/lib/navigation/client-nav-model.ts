import type { AppShellNavItem } from "@/components/layout/app-shell-nav-item";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import { type EntityCapability, entityRoleCan } from "@auction/domain";
import type { LegalEntityMemberRole } from "@auction/types";
import {
  Bell,
  Brush,
  Building2,
  CreditCard,
  Heart,
  Layers,
  Menu,
  Package,
  Settings,
  Store,
  TrendingUp,
  Upload,
  WalletCards,
} from "lucide-react";

/**
 * Whose account the signed-in person is acting for. Organisation members are limited by the
 * capability matrix in `@auction/domain`, so the sidebar never offers a page the API would refuse.
 */
export type ClientNavContext =
  | { kind: "personal" }
  | { kind: "organisation"; role: LegalEntityMemberRole };

export type ClientNavInput = {
  mode: ClientWorkspaceMode;
  context: ClientNavContext;
  /** False hides every organisation entry (kill switch). */
  orgModuleEnabled: boolean;
  /** True when the person belongs to at least one organisation. */
  isOrgMember: boolean;
};

/** Everything about the viewer that shapes the nav except the workspace mode, which follows the route. */
export type ClientNavScope = Omit<ClientNavInput, "mode">;

/** A personal account that belongs to no organisation. */
export const PERSONAL_NAV_SCOPE: ClientNavScope = {
  context: { kind: "personal" },
  orgModuleEnabled: true,
  isOrgMember: false,
};

type NavSpec = {
  item: AppShellNavItem;
  /** Organisation members need at least one of these; personal accounts always pass. */
  anyCapability?: readonly EntityCapability[];
  /** Hidden when acting for an organisation. */
  personalOnly?: true;
  /** Hidden unless the person belongs to an organisation and the module is on. */
  orgMembersOnly?: true;
};

function exactOrNested(href: string) {
  return (pathname: string) => pathname === href || pathname.startsWith(`${href}/`);
}

const NOTIFICATIONS: NavSpec = {
  item: {
    id: "notifications",
    label: "Notifications",
    href: "/dashboard/notifications",
    icon: Bell,
  },
};

const BID_SETTINGS: NavSpec = {
  item: {
    id: "settings",
    label: "Bid settings",
    href: "/dashboard/settings/bidding",
    icon: Settings,
    match: exactOrNested("/dashboard/settings"),
  },
};

const BUYING_SPECS: readonly NavSpec[] = [
  { item: { id: "bids", label: "My bids", href: "/dashboard/bids", icon: TrendingUp } },
  {
    item: {
      id: "purchases",
      label: "Purchases",
      href: "/dashboard/purchases",
      icon: Package,
      match: exactOrNested("/dashboard/purchases"),
    },
    // Won lots show prices and payment state, so an organisation needs either the
    // works-only or the money view of what it owns.
    anyCapability: ["entity.holdings.read", "entity.finance.read"],
  },
  {
    item: {
      id: "watchlist",
      label: "Watching",
      href: "/dashboard/watchlist",
      icon: Heart,
      match: exactOrNested("/dashboard/watchlist"),
    },
  },
  {
    item: {
      id: "organisations",
      label: "Your organisations",
      href: "/dashboard/organisations",
      icon: Building2,
      match: (pathname) =>
        pathname.startsWith("/dashboard/organisations") ||
        pathname.startsWith("/dashboard/invitations"),
    },
    orgMembersOnly: true,
  },
  NOTIFICATIONS,
  BID_SETTINGS,
];

const SELLING_SPECS: readonly NavSpec[] = [
  {
    item: {
      id: "seller-overview",
      label: "Seller overview",
      href: "/dashboard/seller",
      icon: Store,
      match: (pathname) => pathname === "/dashboard/seller",
    },
    anyCapability: ["entity.consignments.read"],
  },
  {
    item: {
      id: "submissions",
      label: "Submissions",
      href: "/dashboard/submissions",
      icon: Upload,
      match: exactOrNested("/dashboard/submissions"),
    },
    anyCapability: ["entity.consignments.read"],
  },
  {
    item: {
      id: "in-sale",
      label: "Items in sale",
      href: "/dashboard/seller/in-sale",
      icon: Layers,
    },
    anyCapability: ["entity.consignments.read"],
  },
  {
    item: {
      id: "payouts",
      label: "Sold & payouts",
      href: "/dashboard/seller/payouts",
      icon: WalletCards,
    },
    anyCapability: ["entity.payouts.read"],
  },
  {
    item: {
      id: "connect",
      label: "Payout setup",
      href: "/dashboard/seller/connect",
      icon: CreditCard,
      match: exactOrNested("/dashboard/seller/connect"),
    },
    anyCapability: ["entity.connect.operate"],
  },
  {
    item: { id: "artist", label: "Artist profile", href: "/dashboard/seller/artist", icon: Brush },
    personalOnly: true,
  },
  NOTIFICATIONS,
  BID_SETTINGS,
];

function isVisible(spec: NavSpec, input: ClientNavInput): boolean {
  if (spec.orgMembersOnly && !(input.orgModuleEnabled && input.isOrgMember)) return false;
  if (input.context.kind === "personal") return true;
  if (spec.personalOnly) return false;
  if (!spec.anyCapability) return true;
  const { role } = input.context;
  return spec.anyCapability.some((capability) => entityRoleCan(role, capability));
}

/** Sidebar entries for one mode, one context and the viewer's capabilities. */
export function getClientNavItems(input: ClientNavInput): AppShellNavItem[] {
  const specs = input.mode === "selling" ? SELLING_SPECS : BUYING_SPECS;
  return specs.filter((spec) => isVisible(spec, input)).map((spec) => spec.item);
}

const BUYING_TAB_IDS = ["bids", "purchases", "watchlist", "notifications"] as const;
const SELLING_TAB_IDS = ["seller-overview", "submissions", "in-sale", "notifications"] as const;

const MORE_TAB: AppShellNavItem = { id: "more", label: "More", href: "#more", icon: Menu };

/** The most-used entries plus "More", for the mobile bottom bar. */
export function getClientMobileTabs(input: ClientNavInput): AppShellNavItem[] {
  const items = getClientNavItems(input);
  const tabIds: readonly string[] = input.mode === "selling" ? SELLING_TAB_IDS : BUYING_TAB_IDS;
  const tabs = tabIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is AppShellNavItem => item != null);
  return [...tabs, MORE_TAB];
}
