import type { BreadcrumbItem } from "@/components/dashboard/primitives/breadcrumbs";
import { settingsSectionLabel } from "@/lib/navigation/settings-section-labels";
import { CLIENT_ROUTES } from "./client-routes";

/**
 * A crumb. `record` marks the current crumb of a record page: it reads as the record's own title
 * once the page names it (`SetMobileShellTitle`), and the label is only the fallback.
 */
export type Crumb = BreadcrumbItem & { record?: true };

const MY_BIDS: Crumb = { label: "My bids", href: CLIENT_ROUTES.bids };
const PURCHASES: Crumb = { label: "Purchases", href: CLIENT_ROUTES.purchases };
const CONSIGNMENTS: Crumb = { label: "Consignments", href: CLIENT_ROUTES.consignments };
const SOLD_AND_PAYOUTS: Crumb = { label: "Sold & payouts", href: CLIENT_ROUTES.payouts };
const BID_SETTINGS: Crumb = { label: "Bid settings", href: CLIENT_ROUTES.settings };
const ORGANISATION: Crumb = { label: "Organisation", href: CLIENT_ROUTES.organisation };
const ORGANISATIONS: Crumb = { label: "Organisations", href: CLIENT_ROUTES.organisations };
const INVITATIONS: Crumb = { label: "Invitations", href: CLIENT_ROUTES.invitations };

const ORGANISATION_TAB_LABELS: Record<string, string> = {
  members: "Members",
  documents: "Documents",
  payouts: "Payouts",
  security: "Security",
};

/** The current page, which is never a link. */
function here(label: string): Crumb {
  return { label };
}

/** The current page when it is one record, titled by the page once it knows the title. */
function record(fallback: string): Crumb {
  return { label: fallback, record: true };
}

/** The trail with a record page's own title in its current crumb. */
export function withRecordTitle(items: readonly Crumb[], title: string | null): Crumb[] {
  return items.map((item) => (item.record && title ? { ...item, label: title } : item));
}

/**
 * Every client-area page and its trail, first match wins. Each page has one address, so its
 * trail is the same whichever account is in use.
 */
const TRAILS: readonly [RegExp, (match: RegExpMatchArray) => Crumb[]][] = [
  [/^\/home$/, () => [here("Home")]],
  [/^\/bids$/, () => [here("My bids")]],
  [/^\/bids\/telephone\/[^/]+$/, () => [MY_BIDS, here("Telephone bid")]],
  [/^\/purchases$/, () => [here("Purchases")]],
  [/^\/purchases\/checkout(\/[^/]+)?$/, () => [PURCHASES, here("Checkout")]],
  [/^\/watching$/, () => [here("Watching")]],
  [/^\/notifications$/, () => [here("Notifications")]],
  [/^\/settings$/, () => [here("Bid settings")]],
  [/^\/settings\/([^/]+)$/, (m) => [BID_SETTINGS, here(settingsSectionLabel(m[1] ?? ""))]],
  [/^\/selling\/new$/, () => [CONSIGNMENTS, here("New submission")]],
  [/^\/selling\/consignments$/, () => [here("Consignments")]],
  [/^\/selling\/consignments\/[^/]+$/, () => [CONSIGNMENTS, record("Consignment")]],
  [
    /^\/selling\/consignments\/([^/]+)\/edit$/,
    (m) => [
      CONSIGNMENTS,
      { label: "Consignment", href: `${CLIENT_ROUTES.consignments}/${m[1] ?? ""}` },
      here("Make changes"),
    ],
  ],
  [/^\/selling\/works$/, () => [here("Works")]],
  [/^\/selling\/payouts$/, () => [here("Sold & payouts")]],
  [/^\/selling\/payout-setup$/, () => [SOLD_AND_PAYOUTS, here("Payout setup")]],
  [/^\/selling\/artist$/, () => [here("Artist profile")]],
  [/^\/legal-entities\/.+\/statement$/, () => [SOLD_AND_PAYOUTS, here("Statement")]],
  [/^\/organisation$/, () => [here("Organisation")]],
  [
    /^\/organisation\/([^/]+)$/,
    (m) => [ORGANISATION, here(ORGANISATION_TAB_LABELS[m[1] ?? ""] ?? "Organisation")],
  ],
  [/^\/organisations$/, () => [here("Organisations")]],
  [/^\/organisations\/invitations$/, () => [ORGANISATIONS, here("Invitations")]],
  [/^\/organisations\/invitations\/review\/[^/]+$/, () => [INVITATIONS, here("Review invitation")]],
  [/^\/organisations\/invitations\/accept\/[^/]+$/, () => [INVITATIONS, here("Accept invitation")]],
  [/^\/verify-identity$/, () => [here("Verify identity")]],
  [/^\/compliance\/source-of-funds$/, () => [here("Source of funds")]],
  [/^\/no-access$/, () => [here("No access")]],
  [/^\/switch-account\/confirm$/, () => [here("Switch account")]],
  [/^\/switch-account\/unavailable$/, () => [here("Your accounts")]],
];

/** Human-readable breadcrumb trail for a signed-in client-area page. */
export function buildClientBreadcrumbTrail(pathname: string): Crumb[] {
  const path = pathname.replace(/\/+$/, "") || "/";
  for (const [pattern, trail] of TRAILS) {
    const match = path.match(pattern);
    if (match) return trail(match);
  }
  return [here("Detail")];
}
