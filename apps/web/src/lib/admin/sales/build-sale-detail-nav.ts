import { type SaleDetailTab, saleDetailTabHref } from "@/lib/admin/sales/sale-detail-routes";
import {
  SALE_DETAIL_GROUPS,
  SALE_DETAIL_SECTIONS,
  type SaleDetailGroupId,
  type SaleSectionContext,
  isSaleSectionAvailable,
} from "@/lib/admin/sales/sale-detail-sections";
import type { TabNavItem } from "@auction/staff-ui";
import type { SaleDeliveryMode } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";

export type BuildSaleDetailNavInput = {
  saleId: string;
  deliveryMode: SaleDeliveryMode;
  liveish: boolean;
  lotCount: number;
  registrationCount?: number | null;
  pendingRegistrationCount: number;
  pendingTelephoneBookingCount: number;
  documentCount?: number | null;
  overviewAttentionCount: number;
  /** Whether the viewer holds `SALES_ACCESS`; see `SaleSectionRequirement`. */
  canManageSales?: boolean;
};

export type SaleDetailNavPage = TabNavItem & { id: SaleDetailTab };
export type SaleDetailNavGroup = TabNavItem & {
  id: SaleDetailGroupId;
  pages: readonly SaleDetailNavPage[];
};

/** A page's size and the part of it waiting on staff (registrations or bookings to review). */
type SectionTally = { count?: number; waiting?: number };

type TabCountFields = Pick<TabNavItem, "count" | "countTone" | "countLabel">;

const WAITING_LABEL = "waiting";

/** Each page's tally. Pages without one show no count. */
function saleSectionTallies(
  input: BuildSaleDetailNavInput,
  isSaleroom: boolean,
): Partial<Record<SaleDetailTab, SectionTally>> {
  const {
    liveish,
    lotCount,
    registrationCount = null,
    pendingRegistrationCount,
    pendingTelephoneBookingCount,
    documentCount = null,
    overviewAttentionCount,
  } = input;
  return {
    ...(overviewAttentionCount > 0 ? { overview: { count: overviewAttentionCount } } : {}),
    lots: { count: lotCount },
    registrations: {
      ...(liveish && registrationCount != null ? { count: registrationCount } : {}),
      ...(liveish && pendingRegistrationCount > 0 ? { waiting: pendingRegistrationCount } : {}),
    },
    "telephone-bookings":
      isSaleroom && pendingTelephoneBookingCount > 0
        ? { waiting: pendingTelephoneBookingCount }
        : {},
    documents: { count: documentCount ?? 0 },
  };
}

/** Work waiting outranks size: a page with bookings to review shows how many, in ink. */
function tallyCount(tally: SectionTally | undefined): TabCountFields {
  if (tally?.waiting) {
    return { count: tally.waiting, countTone: "attention", countLabel: WAITING_LABEL };
  }
  return tally?.count !== undefined ? { count: tally.count } : {};
}

/**
 * A group with one page shows that page's count. A group of several rolls up only what is
 * waiting, since adding unlike sizes together (documents and press) would mean nothing.
 */
function groupCount(
  pages: readonly SaleDetailNavPage[],
  tallies: Partial<Record<SaleDetailTab, SectionTally>>,
): TabCountFields {
  const [only] = pages;
  if (pages.length === 1 && only) return tallyCount(tallies[only.id]);
  const waiting = pages.reduce((sum, page) => sum + (tallies[page.id]?.waiting ?? 0), 0);
  return tallyCount(waiting > 0 ? { waiting } : undefined);
}

/**
 * The sale's tabs for this viewer: each group with the pages they are offered, in order. A group
 * opens its first page; a group with no page offered is left out.
 */
export function buildSaleDetailNav(input: BuildSaleDetailNavInput): SaleDetailNavGroup[] {
  const isSaleroom = isSaleroomDeliveryMode(input.deliveryMode);
  const context: SaleSectionContext = {
    canManageSales: input.canManageSales ?? false,
    isSaleroom,
  };
  const tallies = saleSectionTallies(input, isSaleroom);

  return SALE_DETAIL_GROUPS.flatMap((group) => {
    const pages: SaleDetailNavPage[] = group.sections
      .filter((section) => isSaleSectionAvailable(section, context))
      .map((section) => ({
        id: section,
        label: SALE_DETAIL_SECTIONS[section].label,
        href: saleDetailTabHref(input.saleId, section),
        ...tallyCount(tallies[section]),
      }));
    const [first] = pages;
    if (!first) return [];
    return [
      {
        id: group.id,
        label: group.label,
        href: first.href,
        pages,
        ...groupCount(pages, tallies),
      },
    ];
  });
}

export type SaleDetailNavState = {
  group: SaleDetailNavGroup | null;
  /** The group's pages as secondary tabs, when it has more than one. */
  pages: readonly SaleDetailNavPage[];
  pageId: SaleDetailTab;
};

/** Which group and page the current page sits in. */
export function resolveSaleDetailNav(
  groups: readonly SaleDetailNavGroup[],
  pageId: SaleDetailTab,
): SaleDetailNavState {
  const group =
    groups.find((candidate) => candidate.pages.some((page) => page.id === pageId)) ??
    groups[0] ??
    null;
  const pages = group && group.pages.length > 1 ? group.pages : [];
  return { group, pages, pageId };
}
