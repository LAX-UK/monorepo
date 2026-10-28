import type { AppShellNavItem } from "@/components/layout/app-shell-nav-item";
import { laxAccountHomeUrl } from "@/lib/lax-account-url";
import { type EntityCapability, entityRoleCan } from "@auction/domain";
import {
  Bell,
  Building2,
  Heart,
  House,
  Layers,
  Menu,
  Package,
  Settings,
  Store,
  TrendingUp,
  Upload,
  UserRound,
  WalletCards,
} from "lucide-react";
import type { AccountContext } from "./account-home";
import { CLIENT_ROUTES } from "./client-routes";
import { ORGANISATION_PAGE_CAPABILITIES } from "./organisation-tabs";

export type { AccountContext };

/**
 * Everything about the viewer that shapes the Bid menu. There is no buying or selling mode: one
 * menu has a Buying and a Selling section, and the account switcher decides whose pages they are.
 * Organisation members see only what the capability table in `@auction/domain` grants their role,
 * so the menu never offers a page the API would refuse.
 */
export type ClientNavScope = {
  context: AccountContext;
  /** The person has submitted work to sell, so their personal Selling section has pages. */
  hasSubmissions: boolean;
};

/** A personal account that has not sold anything yet. */
export const PERSONAL_NAV_SCOPE: ClientNavScope = {
  context: { kind: "personal" },
  hasSubmissions: false,
};

export type ClientNavSectionId = "home" | "buying" | "selling" | "organisation" | "account";

/** One block of the menu: a heading (or none) and its entries. */
export type ClientNavSection = {
  id: ClientNavSectionId;
  /** Shown above the entries; `null` for the Home entry and the account block. */
  label: string | null;
  items: AppShellNavItem[];
};

type Audience = "personal" | "organisation" | "both";

type NavSpec = {
  audience: Audience;
  item: (scope: ClientNavScope) => AppShellNavItem;
  /** Organisation members need at least one of these; personal accounts always pass. */
  anyCapability?: readonly EntityCapability[];
  /** Extra condition for personal accounts. */
  personalWhen?: (scope: ClientNavScope) => boolean;
};

type SectionSpec = {
  id: ClientNavSectionId;
  label: string | null;
  specs: readonly NavSpec[];
};

function exactOrNested(href: string) {
  return (pathname: string) => pathname === href || pathname.startsWith(`${href}/`);
}

function isOrganisation(scope: ClientNavScope): boolean {
  return scope.context.kind === "organisation";
}

const HOME: NavSpec = {
  audience: "organisation",
  item: () => ({
    id: "home",
    label: "Home",
    href: CLIENT_ROUTES.home,
    icon: House,
    // Until organisations have a Home page, Home opens the selling overview.
    match: (pathname) => pathname === CLIENT_ROUTES.home || pathname === CLIENT_ROUTES.selling,
  }),
};

const BIDS: NavSpec = {
  audience: "both",
  item: (scope) => ({
    id: "bids",
    // Personal bids are the person's own; an organisation's are everyone's who bids for it.
    label: isOrganisation(scope) ? "Bids" : "My bids",
    href: CLIENT_ROUTES.bids,
    icon: TrendingUp,
    match: exactOrNested(CLIENT_ROUTES.bids),
  }),
  anyCapability: ["entity.bid.place"],
};

const PURCHASES: NavSpec = {
  audience: "both",
  item: () => ({
    id: "purchases",
    label: "Purchases",
    href: CLIENT_ROUTES.purchases,
    icon: Package,
    match: exactOrNested(CLIENT_ROUTES.purchases),
  }),
  // The organisation's money view, or a buyer agent's own wins.
  anyCapability: ["entity.finance.read", "entity.bid.place"],
};

const WATCHING: NavSpec = {
  audience: "both",
  item: () => ({
    id: "watchlist",
    label: "Watching",
    href: CLIENT_ROUTES.watching,
    icon: Heart,
    match: exactOrNested(CLIENT_ROUTES.watching),
  }),
  // Watching follows lots to bid on or to sell; members who do neither have no use for it.
  anyCapability: ["entity.bid.place", "entity.submissions.create"],
};

const SELL_WITH_LAX: NavSpec = {
  audience: "personal",
  item: () => ({
    id: "sell",
    label: "Sell with LAX",
    href: CLIENT_ROUTES.sellingNew,
    icon: Store,
    match: (pathname) => pathname === CLIENT_ROUTES.sellingNew,
  }),
  personalWhen: (scope) => !scope.hasSubmissions,
};

const CONSIGNMENTS: NavSpec = {
  audience: "both",
  item: (scope) => ({
    id: "consignments",
    label: "Consignments",
    // "Consignments" does not fit a phone tab, so the tab takes the menu section's name.
    shortLabel: "Selling",
    href: CLIENT_ROUTES.consignments,
    icon: Upload,
    // Submissions are consignments before they are accepted, so a new one belongs here too, and
    // a personal account's selling overview (which has no menu entry of its own) as well.
    match: (pathname) =>
      exactOrNested(CLIENT_ROUTES.consignments)(pathname) ||
      pathname === CLIENT_ROUTES.sellingNew ||
      (!isOrganisation(scope) && pathname === CLIENT_ROUTES.selling),
  }),
  anyCapability: ["entity.consignments.read"],
  personalWhen: (scope) => scope.hasSubmissions,
};

const WORKS: NavSpec = {
  // An organisation's own works; a person's are in Purchases and LAX Account.
  audience: "organisation",
  item: () => ({ id: "works", label: "Works", href: CLIENT_ROUTES.works, icon: Layers }),
  anyCapability: ["entity.holdings.read", "entity.finance.read"],
};

const SOLD_AND_PAYOUTS: NavSpec = {
  audience: "both",
  item: () => ({
    id: "payouts",
    label: "Sold & payouts",
    shortLabel: "Payouts",
    href: CLIENT_ROUTES.payouts,
    icon: WalletCards,
    // A person's payout setup is reached from their payouts.
    match: (pathname) =>
      exactOrNested(CLIENT_ROUTES.payouts)(pathname) ||
      exactOrNested(CLIENT_ROUTES.payoutSetup)(pathname) ||
      pathname.startsWith("/legal-entities/"),
  }),
  anyCapability: ["entity.payouts.read"],
  personalWhen: (scope) => scope.hasSubmissions,
};

const ORGANISATION_SETTINGS: NavSpec = {
  audience: "organisation",
  item: () => ({
    id: "organisation",
    label: "Organisation settings",
    href: CLIENT_ROUTES.organisation,
    icon: Building2,
    match: exactOrNested(CLIENT_ROUTES.organisation),
  }),
  anyCapability: ORGANISATION_PAGE_CAPABILITIES,
};

const NOTIFICATIONS: NavSpec = {
  audience: "both",
  item: () => ({
    id: "notifications",
    label: "Notifications",
    shortLabel: "Alerts",
    href: CLIENT_ROUTES.notifications,
    icon: Bell,
  }),
};

const BID_SETTINGS: NavSpec = {
  audience: "both",
  item: () => ({
    id: "settings",
    label: "Bid settings",
    href: CLIENT_ROUTES.settings,
    icon: Settings,
    match: exactOrNested(CLIENT_ROUTES.settings),
  }),
};

/** Profile, security and addresses are managed in LAX Account, for every LAX product. */
const LAX_ACCOUNT: NavSpec = {
  audience: "both",
  item: () => ({
    id: "lax-account",
    label: "LAX Account",
    href: laxAccountHomeUrl(),
    icon: UserRound,
    match: () => false,
    external: true,
  }),
};

/** The whole menu, in order. Adding or moving an entry is one edit here. */
const SECTIONS: readonly SectionSpec[] = [
  { id: "home", label: null, specs: [HOME] },
  { id: "buying", label: "Buying", specs: [BIDS, PURCHASES, WATCHING] },
  {
    id: "selling",
    label: "Selling",
    specs: [SELL_WITH_LAX, CONSIGNMENTS, WORKS, SOLD_AND_PAYOUTS],
  },
  { id: "organisation", label: "Organisation", specs: [ORGANISATION_SETTINGS] },
  { id: "account", label: null, specs: [NOTIFICATIONS, BID_SETTINGS, LAX_ACCOUNT] },
];

function isVisible(spec: NavSpec, scope: ClientNavScope): boolean {
  const { context } = scope;
  if (context.kind === "personal") {
    if (spec.audience === "organisation") return false;
    return spec.personalWhen ? spec.personalWhen(scope) : true;
  }
  if (spec.audience === "personal") return false;
  if (!spec.anyCapability) return true;
  return spec.anyCapability.some((capability) => entityRoleCan(context.role, capability));
}

/** The menu for one account, as sections; sections with nothing to show are left out. */
export function getClientNavSections(scope: ClientNavScope): ClientNavSection[] {
  return SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
    items: section.specs.filter((spec) => isVisible(spec, scope)).map((spec) => spec.item(scope)),
  })).filter((section) => section.items.length > 0);
}

/** Every menu entry for one account, in order. */
export function getClientNavItems(scope: ClientNavScope): AppShellNavItem[] {
  return getClientNavSections(scope).flatMap((section) => section.items);
}

/** Which entries earn a place in the phone's bottom bar, most important first. */
const MOBILE_TAB_PRIORITY = [
  "home",
  "bids",
  "purchases",
  "watchlist",
  "consignments",
  "payouts",
  "works",
  "notifications",
] as const;

/** The bottom bar has room for four entries plus More. */
const MAX_TABS = 4;

const MORE_TAB: AppShellNavItem = { id: "more", label: "More", href: "#more", icon: Menu };

/** The most-used entries plus "More", for the mobile bottom bar. */
export function getClientMobileTabs(scope: ClientNavScope): AppShellNavItem[] {
  const items = getClientNavItems(scope);
  const tabs = MOBILE_TAB_PRIORITY.map((id) => items.find((item) => item.id === id))
    .filter((item): item is AppShellNavItem => item != null)
    .slice(0, MAX_TABS);
  return [...tabs, MORE_TAB];
}
