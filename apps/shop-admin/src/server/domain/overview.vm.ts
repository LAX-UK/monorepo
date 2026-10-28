import type { AdminOverviewKpis } from "@auction/shop-contracts";
import type { AdminNavGroup } from "./admin-nav.vm";
import { enquiriesList } from "./enquiry-inbox.vm";

export type OverviewTile = {
  key: string;
  label: string;
  value: number;
  href: string;
  tone?: "warning";
  /** Shown even at 0: an open edition with no prints on sale needs someone most of all. */
  keepWhenZero?: boolean;
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
    {
      key: "payouts",
      label: "Payouts due",
      href: "/payouts?view=due",
      value: input.kpis.payoutsDueCount,
    },
    {
      key: "holds",
      label: "Active holds",
      href: "/holds?view=active",
      value: input.kpis.activeHoldsCount,
    },
    {
      key: "requests",
      label: "Pending limit requests",
      href: "/requests",
      value: input.kpis.pendingAuthorityRequestsCount,
    },
    {
      key: "enquiries",
      label: "New enquiries",
      href: enquiriesList.href(enquiriesList.parse({}), { view: "new" }),
      value: input.newEnquiryCount ?? undefined,
    },
  ];
  const queues = sources.flatMap(({ href, value, ...rest }) => {
    const path = href.split("?")[0] ?? href;
    return value !== undefined && reachable.has(path) ? [{ ...rest, href, value }] : [];
  });
  return [...queues, ...lowStockTiles(input.kpis, reachable)];
}

/**
 * One item per live open edition with 3 or fewer prints on sale ("Night garden: prints on sale",
 * with the count), linking to its Stock panel. The API sends these only to staff who can add
 * prints; the artworks page must be reachable too.
 */
function lowStockTiles(kpis: AdminOverviewKpis, reachable: ReadonlySet<string>): OverviewTile[] {
  if (!kpis.lowStockRuns || !reachable.has("/artworks")) return [];
  return kpis.lowStockRuns.map((run) => ({
    key: `low-stock-${run.artworkId}`,
    label: `${run.title}: ${run.onSale === 1 ? "print" : "prints"} on sale`,
    value: run.onSale,
    href: `/artworks/${run.artworkId}#stock`,
    tone: "warning" as const,
    keepWhenZero: true,
  }));
}

/** Whether any item on the Overview needs someone. */
export function overviewNeedsAttention(tiles: readonly OverviewTile[]): boolean {
  return tiles.some((tile) => tile.value > 0 || tile.keepWhenZero === true);
}

/** The areas a role can open, for the welcome shown when it has no figures of its own. */
export function buildWelcomeSections(navGroups: readonly AdminNavGroup[]): AdminNavGroup[] {
  return navGroups.filter((group) => group.title !== "Overview");
}
