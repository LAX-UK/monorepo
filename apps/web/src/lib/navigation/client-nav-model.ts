import type { AppShellNavItem } from "@/components/layout/app-shell-nav-item";
import { laxAccountHomeUrl } from "@/lib/lax-account-url";
import { SELL_A_WORK_LABEL } from "@/lib/marketing/sell-flow-copy";
import { type EntityCapability, entityRoleCan } from "@auction/domain";
import type { LegalEntityMemberRole } from "@auction/types";
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
  Users,
  WalletCards,
} from "lucide-react";
import type { AccountContext } from "./account-home";
import { CLIENT_ROUTES } from "./client-routes";
import { ORGANISATION_PAGE_CAPABILITIES } from "./organisation-tabs";
import { TEAM_PAGE_CAPABILITIES } from "./team-tabs";

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

export type ClientNavSectionId =
  | "home"
  | "buying"
  | "selling"
  | "collection"
  | "organisation"
  | "account";

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

/**
 * How a section appears in the account sub-navigation under the public header:
 * - `entries`: one link per entry;
 * - `one-link`: a single link named after the section, current anywhere under `prefix`;
 * - `hidden`: not in the sub-navigation (workspace-only sections).
 * External entries (LAX Account) never appear there: the band is for Bid's own pages.
 */
type SubNavShape = { kind: "entries" } | { kind: "one-link"; prefix: string } | { kind: "hidden" };

type SectionSpec = {
  id: ClientNavSectionId;
  label: string | null;
  specs: readonly NavSpec[];
  subNav: SubNavShape;
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
    match: (pathname) => pathname === CLIENT_ROUTES.home,
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
    label: SELL_A_WORK_LABEL,
    href: CLIENT_ROUTES.sellingNew,
    icon: Store,
    match: (pathname) => pathname === CLIENT_ROUTES.sellingNew,
  }),
  personalWhen: (scope) => !scope.hasSubmissions,
};

const CONSIGNMENTS: NavSpec = {
  audience: "both",
  item: () => ({
    id: "consignments",
    label: "Consignments",
    // "Consignments" does not fit a phone tab, so the tab takes the menu section's name.
    shortLabel: "Selling",
    href: CLIENT_ROUTES.consignments,
    icon: Upload,
    // Submissions are consignments before they are accepted, so a new one belongs here too.
    match: (pathname) =>
      exactOrNested(CLIENT_ROUTES.consignments)(pathname) || pathname === CLIENT_ROUTES.sellingNew,
  }),
  anyCapability: ["entity.consignments.read"],
  personalWhen: (scope) => scope.hasSubmissions,
};

const WORKS: NavSpec = {
  // An organisation's own works, its collection; a person's are in Purchases and LAX Account.
  audience: "organisation",
  item: () => ({
    id: "works",
    label: "Works",
    href: CLIENT_ROUTES.collection,
    icon: Layers,
    match: exactOrNested(CLIENT_ROUTES.collection),
  }),
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

const TEAM: NavSpec = {
  audience: "organisation",
  item: () => ({
    id: "team",
    label: "Team",
    href: CLIENT_ROUTES.team,
    icon: Users,
    match: exactOrNested(CLIENT_ROUTES.team),
  }),
  anyCapability: TEAM_PAGE_CAPABILITIES,
};

const ORGANISATION_SETTINGS: NavSpec = {
  audience: "organisation",
  item: () => ({
    id: "organisation",
    label: "Organisation",
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
  { id: "home", label: null, specs: [HOME], subNav: { kind: "hidden" } },
  {
    id: "buying",
    label: "Buying",
    specs: [BIDS, PURCHASES, WATCHING],
    subNav: { kind: "entries" },
  },
  {
    id: "selling",
    label: "Selling",
    specs: [SELL_WITH_LAX, CONSIGNMENTS, SOLD_AND_PAYOUTS],
    subNav: { kind: "one-link", prefix: CLIENT_ROUTES.selling },
  },
  { id: "collection", label: "Collection", specs: [WORKS], subNav: { kind: "hidden" } },
  {
    id: "organisation",
    label: "Organisation",
    specs: [TEAM, ORGANISATION_SETTINGS],
    subNav: { kind: "hidden" },
  },
  {
    id: "account",
    label: null,
    specs: [NOTIFICATIONS, BID_SETTINGS, LAX_ACCOUNT],
    subNav: { kind: "entries" },
  },
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

/** Any organisation member's menu, to name a page the way the workspace menu does. */
const ANY_ORGANISATION_SCOPE: ClientNavScope = {
  context: { kind: "organisation", id: "", role: "owner" },
  hasSubmissions: true,
};

/** A workspace menu entry: its name and what a member needs to open it (empty: everyone). */
export type WorkspaceMenuEntry = { label: string; anyCapability: readonly EntityCapability[] };

/** The workspace menu entry `pathname` belongs to, or `null` for a page outside the menu. */
export function workspaceMenuEntryAt(pathname: string): WorkspaceMenuEntry | null {
  for (const section of SECTIONS) {
    for (const spec of section.specs) {
      if (spec.audience === "personal") continue;
      const item = spec.item(ANY_ORGANISATION_SCOPE);
      if (item.external || !navItemMatches(item, pathname)) continue;
      return { label: item.label, anyCapability: spec.anyCapability ?? [] };
    }
  }
  return null;
}

/** Whether a menu entry is the page at `pathname` (its own rule, else its exact address). */
export function navItemMatches(
  item: Pick<AppShellNavItem, "href" | "match">,
  pathname: string,
): boolean {
  return item.match ? item.match(pathname) : item.href === pathname;
}

/** One link in the account sub-navigation. */
export type ClientSubNavEntry = {
  id: string;
  label: string;
  href: string;
  match: (pathname: string) => boolean;
};

function subNavEntries(section: SectionSpec, items: AppShellNavItem[]): ClientSubNavEntry[] {
  const shape = section.subNav;
  const own = items.filter((item) => !item.external);
  if (shape.kind === "hidden" || own.length === 0) return [];
  if (shape.kind === "entries") {
    return own.map((item) => ({
      id: item.id,
      label: item.label,
      href: item.href,
      match: (pathname) => navItemMatches(item, pathname),
    }));
  }
  const [first] = own;
  if (!first || !section.label) return [];
  return [
    {
      id: section.id,
      label: section.label,
      href: first.href,
      match: (pathname) =>
        exactOrNested(shape.prefix)(pathname) || own.some((item) => navItemMatches(item, pathname)),
    },
  ];
}

/**
 * The account sub-navigation for one account: Bid's own pages in one row, with a section that
 * holds several pages (Selling) reached through a single link.
 */
export function getClientSubNav(scope: ClientNavScope): ClientSubNavEntry[] {
  return SECTIONS.flatMap((section) =>
    subNavEntries(
      section,
      section.specs.filter((spec) => isVisible(spec, scope)).map((spec) => spec.item(scope)),
    ),
  );
}

/** The id of the entry for `pathname`, or `null` when the page is not one of them. */
export function currentNavEntryId(
  entries: readonly { id: string; match: (pathname: string) => boolean }[],
  pathname: string,
): string | null {
  return entries.find((entry) => entry.match(pathname))?.id ?? null;
}

/** Every menu entry for one account, in order. */
export function getClientNavItems(scope: ClientNavScope): AppShellNavItem[] {
  return getClientNavSections(scope).flatMap((section) => section.items);
}

/**
 * An organisation member's four phone tabs, by role: the pages that role opens most. Everything
 * else is in More. A role's list names only pages the role can open, and `getClientMobileTabs`
 * still checks each against the menu, so the bar never offers a page the API would refuse.
 */
const ORGANISATION_TABS: Readonly<Record<LegalEntityMemberRole, readonly string[]>> = {
  owner: ["home", "bids", "purchases", "consignments"],
  admin: ["home", "bids", "purchases", "consignments"],
  finance: ["home", "purchases", "payouts"],
  buyer_agent: ["home", "bids", "purchases", "watchlist"],
  consignor: ["home", "consignments", "watchlist"],
  viewer: ["home", "consignments", "works"],
};

/** Which entries earn a place in a personal account's bottom bar, most important first. */
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
  const order =
    scope.context.kind === "organisation"
      ? ORGANISATION_TABS[scope.context.role]
      : MOBILE_TAB_PRIORITY;
  const tabs = order
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is AppShellNavItem => item != null)
    .slice(0, MAX_TABS);
  return [...tabs, MORE_TAB];
}
