import type { AdminOverviewKpis } from "@auction/shop-contracts";
import type { AdminNavGroup } from "./admin-nav.vm";
import { enquiryInboxHref } from "./enquiry-inbox.vm";

export type OverviewTile = {
  key: string;
  label: string;
  value: number;
  href: string;
};

type TileSource = { key: string; label: string; href: string; value: number | undefined };

/**
 * One tile per figure the caller was sent AND can open. The API already omits figures a role may
 * not see; checking the link target against the navigation as well keeps a tile from pointing at
 * a page that is hidden for this role or switched off for the deployment.
 */
export function buildOverviewTiles(input: {
  navGroups: readonly AdminNavGroup[];
  kpis: AdminOverviewKpis;
  newEnquiryCount: number | null;
}): OverviewTile[] {
  const reachable = new Set(input.navGroups.flatMap((group) => group.items.map((i) => i.href)));
  const sources: TileSource[] = [
    {
      key: "fulfil",
      label: "To fulfil",
      href: "/fulfilment",
      value: input.kpis.fulfilmentOpenCount,
    },
    { key: "payouts", label: "Payouts due", href: "/payouts", value: input.kpis.payoutsDueCount },
    { key: "holds", label: "Active holds", href: "/holds", value: input.kpis.activeHoldsCount },
    {
      key: "requests",
      label: "Pending limit requests",
      href: "/requests",
      value: input.kpis.pendingAuthorityRequestsCount,
    },
    {
      key: "enquiries",
      label: "New enquiries",
      href: enquiryInboxHref({}, { status: "new" }),
      value: input.newEnquiryCount ?? undefined,
    },
  ];
  return sources.flatMap(({ href, value, ...rest }) => {
    const path = href.split("?")[0] ?? href;
    return value !== undefined && reachable.has(path) ? [{ ...rest, href, value }] : [];
  });
}

/** The areas a role can open, for the welcome shown when it has no figures of its own. */
export function buildWelcomeSections(navGroups: readonly AdminNavGroup[]): AdminNavGroup[] {
  return navGroups.filter((group) => group.title !== "Overview");
}
