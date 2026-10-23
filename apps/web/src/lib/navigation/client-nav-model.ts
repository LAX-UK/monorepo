import type { AppShellNavItem } from "@/components/layout/app-shell-nav-item";
import { laxAccountHomeUrl } from "@/lib/lax-account-url";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import { type EntityCapability, entityRoleCan } from "@auction/domain";
import type { LegalEntityMemberRole } from "@auction/types";
import {
  Bell,
  Brush,
  Building2,
  CreditCard,
  FileText,
  Heart,
  Layers,
  Menu,
  Package,
  Settings,
  ShieldCheck,
  Store,
  TrendingUp,
  Upload,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";

/**
 * Whose account the signed-in person is acting for. Organisation members are limited by the
 * capability matrix in `@auction/domain`, so the sidebar never offers a page the API would refuse.
 */
export type ClientNavContext =
  | { kind: "personal" }
  | { kind: "organisation"; id: string; role: LegalEntityMemberRole };

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
  /** Entries that point into an organisation's settings need its id; the rest ignore it. */
  item: AppShellNavItem | ((orgId: string | null) => AppShellNavItem);
  /** Organisation members need at least one of these; personal accounts always pass. */
  anyCapability?: readonly EntityCapability[];
  /** Hidden when acting for an organisation. */
  personalOnly?: true;
  /** Hidden unless acting for an organisation. */
  organisationOnly?: true;
  /** Hidden unless the person belongs to an organisation and the module is on. */
  orgMembersOnly?: true;
};

/** Where an organisation's settings live; the organisation id follows. */
export const ORG_SETTINGS_PATH = "/dashboard/seller/organisations";

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
    href: "/dashboard/settings",
    icon: Settings,
    match: exactOrNested("/dashboard/settings"),
  },
};

/** Profile, security and addresses are managed in LAX Account, for every LAX product. */
const LAX_ACCOUNT: NavSpec = {
  item: {
    id: "lax-account",
    label: "LAX Account",
    href: laxAccountHomeUrl(),
    icon: UserRound,
    match: () => false,
    external: true,
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
        pathname === "/dashboard/organisations" || pathname.startsWith("/dashboard/invitations"),
    },
    orgMembersOnly: true,
  },
  NOTIFICATIONS,
  BID_SETTINGS,
  LAX_ACCOUNT,
];

function orgSettingsItem(
  id: string,
  label: string,
  suffix: string,
  icon: AppShellNavItem["icon"],
): (orgId: string | null) => AppShellNavItem {
  return (orgId) => {
    const href = `${ORG_SETTINGS_PATH}/${orgId ?? ""}${suffix}`;
    return { id, label, href, icon, match: exactOrNested(href) };
  };
}

/** The organisation's overview and profile; its other settings pages have entries of their own. */
function orgDetailsItem(orgId: string | null): AppShellNavItem {
  const href = `${ORG_SETTINGS_PATH}/${orgId ?? ""}`;
  return {
    id: "org-details",
    label: "Organisation",
    href,
    icon: Building2,
    match: (pathname) => pathname === href || pathname === `${href}/profile`,
  };
}

const SELLING_SPECS: readonly NavSpec[] = [
  {
    item: {
      id: "seller-overview",
      label: "Overview",
      href: "/dashboard/seller",
      icon: Store,
      match: (pathname) => pathname === "/dashboard/seller",
    },
    anyCapability: ["entity.consignments.read"],
  },
  {
    item: {
      id: "consignments",
      label: "Consignments",
      href: "/dashboard/seller/consignments",
      icon: Upload,
      // Submissions are consignments before they are accepted, so their pages belong here.
      match: (pathname) =>
        exactOrNested("/dashboard/seller/consignments")(pathname) ||
        exactOrNested("/dashboard/submissions")(pathname),
    },
    anyCapability: ["entity.consignments.read"],
  },
  {
    // An organisation's own works and purchases; a person's are in Purchases and LAX Account.
    item: { id: "works", label: "Works", href: "/dashboard/seller/works", icon: Layers },
    organisationOnly: true,
    anyCapability: ["entity.holdings.read", "entity.finance.read"],
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
    // An organisation's payout setup is one of its settings pages, so its link carries the id.
    item: (orgId) => {
      const href = orgId ? `${ORG_SETTINGS_PATH}/${orgId}/connect` : "/dashboard/seller/connect";
      return {
        id: "connect",
        label: "Payout setup",
        href,
        icon: CreditCard,
        match: exactOrNested(href),
      };
    },
    anyCapability: ["entity.connect.operate"],
  },
  {
    item: { id: "artist", label: "Artist profile", href: "/dashboard/seller/artist", icon: Brush },
    personalOnly: true,
  },
  {
    item: orgDetailsItem,
    organisationOnly: true,
  },
  {
    item: orgSettingsItem("org-members", "Members", "/members", Users),
    organisationOnly: true,
    anyCapability: ["entity.members.manage"],
  },
  {
    // KYB documents have no capability of their own; the people who manage members manage them.
    item: orgSettingsItem("org-documents", "Documents", "/documents", FileText),
    organisationOnly: true,
    anyCapability: ["entity.members.manage"],
  },
  {
    item: orgSettingsItem("org-security", "Two-step policy", "/security", ShieldCheck),
    organisationOnly: true,
    anyCapability: ["entity.security.manage"],
  },
  NOTIFICATIONS,
  BID_SETTINGS,
  LAX_ACCOUNT,
];

function isVisible(spec: NavSpec, input: ClientNavInput): boolean {
  if (spec.orgMembersOnly && !(input.orgModuleEnabled && input.isOrgMember)) return false;
  if (input.context.kind === "personal") return !spec.organisationOnly;
  if (spec.personalOnly) return false;
  if (!spec.anyCapability) return true;
  const { role } = input.context;
  return spec.anyCapability.some((capability) => entityRoleCan(role, capability));
}

/** Sidebar entries for one mode, one context and the viewer's capabilities. */
export function getClientNavItems(input: ClientNavInput): AppShellNavItem[] {
  const specs = input.mode === "selling" ? SELLING_SPECS : BUYING_SPECS;
  const orgId = input.context.kind === "organisation" ? input.context.id : null;
  return specs
    .filter((spec) => isVisible(spec, input))
    .map((spec) => (typeof spec.item === "function" ? spec.item(orgId) : spec.item));
}

const BUYING_TAB_IDS = ["bids", "purchases", "watchlist", "notifications"] as const;
const SELLING_TAB_IDS = [
  "seller-overview",
  "consignments",
  "works",
  "payouts",
  "notifications",
] as const;

/** The bottom bar has room for four entries plus More. */
const MAX_TABS = 4;

const MORE_TAB: AppShellNavItem = { id: "more", label: "More", href: "#more", icon: Menu };

/** The most-used entries plus "More", for the mobile bottom bar. */
export function getClientMobileTabs(input: ClientNavInput): AppShellNavItem[] {
  const items = getClientNavItems(input);
  const tabIds: readonly string[] = input.mode === "selling" ? SELLING_TAB_IDS : BUYING_TAB_IDS;
  const tabs = tabIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is AppShellNavItem => item != null)
    .slice(0, MAX_TABS);
  return [...tabs, MORE_TAB];
}
