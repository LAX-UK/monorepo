import type { DetailAttentionIconKind, DetailAttentionRow } from "@/lib/admin/detail-board/types";
import { lotDetailTabHref } from "@/lib/admin/lots/lot-detail-routes";
import {
  type SaleDetailTab,
  saleDetailTabHref,
  saleEditHref,
} from "@/lib/admin/sales/sale-detail-routes";
import type { SaleAttentionItem, SaleAttentionKind, SaleAttentionResult } from "@auction/domain";

function word(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

type AttentionCopy = {
  title: (count: number) => string;
  actionLabel: string;
};

const KIND_COPY: Record<SaleAttentionKind, AttentionCopy> = {
  setup_readiness: {
    title: () => "Setup check incomplete",
    actionLabel: "Review",
  },
  delete_blocker: {
    title: () => "Delete blocked",
    actionLabel: "Review",
  },
  pending_registrations: {
    title: (count) => `${count} pending bidder ${word(count, "approval", "approvals")}`,
    actionLabel: "Review registrations",
  },
  awaiting_paddle: {
    title: (count) => `${count} approved ${word(count, "bidder", "bidders")} awaiting paddle`,
    actionLabel: "Assign paddles",
  },
  kyc_blocked: {
    title: (count) => `${count} ${word(count, "registration", "registrations")} blocked by KYC`,
    actionLabel: "Review registrations",
  },
  telephone_pending: {
    title: (count) => `${count} telephone ${word(count, "booking", "bookings")} requested`,
    actionLabel: "Review telephone",
  },
  connect_required: {
    title: (count) => `${count} ${word(count, "lot", "lots")} need seller payout setup`,
    actionLabel: "Review lots",
  },
  incomplete_catalog_lots: {
    title: (count) => `${count} ${word(count, "lot", "lots")} missing catalogue details`,
    actionLabel: "Review lots",
  },
  draft_lots_missing_photos: {
    title: (count) => `${count} draft ${word(count, "lot", "lots")} missing photos`,
    actionLabel: "Review lots",
  },
  draft_lots_past_start: {
    title: (count) => `${count} draft ${word(count, "lot", "lots")} past sale start`,
    actionLabel: "Review lots",
  },
  unsettled_sold_lots: {
    title: (count) => `${count} sold ${word(count, "lot", "lots")} without settled payment`,
    actionLabel: "Review payments",
  },
  stale_payments: {
    title: (count) => `${count} stale pending ${word(count, "payment", "payments")}`,
    actionLabel: "Review payments",
  },
  fulfilment_pending: {
    title: (count) => `${count} ${word(count, "lot", "lots")} need fulfilment action`,
    actionLabel: "Review fulfilment",
  },
  condition_reports_open: {
    title: (count) => `${count} open condition ${word(count, "report", "reports")}`,
    actionLabel: "Review reports",
  },
  finance_review: {
    title: (count) => `${count} finance ${word(count, "item", "items")} need review`,
    actionLabel: "Review finance",
  },
  saleroom_needs_closing: {
    title: () => "Live saleroom session needs closing",
    actionLabel: "Open saleroom",
  },
  return_to_inventory: {
    title: (count) => `${count} ${word(count, "lot", "lots")} eligible to return to inventory`,
    actionLabel: "Review lots",
  },
};

const SETUP_CHECK_TITLES: Record<string, string> = {
  lots: "At least one lot attached",
  schedule: "Sale schedule set",
  venue: "Onsite venue details",
  sale_start_future: "Opening time must be in the future",
};

function resolveAttentionTitle(item: SaleAttentionItem): string {
  if (item.kind === "delete_blocker" && item.refs?.[0]) {
    return item.refs[0];
  }
  if (item.kind === "setup_readiness" && item.id.startsWith("setup-sale-")) {
    const checkId = item.id.slice("setup-sale-".length);
    return SETUP_CHECK_TITLES[checkId] ?? KIND_COPY.setup_readiness.title(item.count);
  }
  return KIND_COPY[item.kind].title(item.count);
}

function mapTargetTab(tab: NonNullable<SaleAttentionItem["target"]>["tab"]): SaleDetailTab | null {
  if (!tab) return null;
  if (tab === "telephone") return "telephone-bookings";
  return tab;
}

function resolveAttentionHref(saleId: string, item: SaleAttentionItem): string | undefined {
  const target = item.target;
  if (!target) return undefined;
  if (target.external) return target.external;
  if (target.lotId) return lotDetailTabHref(target.lotId, "overview");
  const tab = mapTargetTab(target.tab);
  if (tab === "schedule") return saleDetailTabHref(saleId, "schedule");
  if (tab === "overview") return saleDetailTabHref(saleId, "overview");
  if (tab) return saleDetailTabHref(saleId, tab);
  if (item.kind === "setup_readiness" && item.id.includes("venue")) {
    return saleEditHref(saleId);
  }
  return saleDetailTabHref(saleId, "overview");
}

function resolveAttentionIconKind(item: SaleAttentionItem): DetailAttentionIconKind {
  switch (item.kind) {
    case "setup_readiness":
      return "setup";
    case "delete_blocker":
      return "delete";
    case "pending_registrations":
    case "awaiting_paddle":
    case "kyc_blocked":
      return "registrations";
    case "telephone_pending":
      return "telephone";
    case "connect_required":
    case "incomplete_catalog_lots":
    case "draft_lots_missing_photos":
    case "draft_lots_past_start":
    case "return_to_inventory":
    case "condition_reports_open":
      return "catalog";
    case "unsettled_sold_lots":
    case "stale_payments":
    case "finance_review":
      return "finance";
    case "fulfilment_pending":
      return "general";
    case "saleroom_needs_closing":
      return "saleroom";
    default:
      return "general";
  }
}

export function mapSaleAttentionItemToRow(
  saleId: string,
  item: SaleAttentionItem,
): DetailAttentionRow {
  const copy = KIND_COPY[item.kind];
  const href = resolveAttentionHref(saleId, item);
  return {
    id: item.id,
    title: resolveAttentionTitle(item),
    count: item.count,
    category: item.category,
    severity: item.severity,
    actionLabel: copy.actionLabel,
    iconKind: resolveAttentionIconKind(item),
    ...(href ? { href } : {}),
  };
}

export function mapSaleAttentionToRows(
  saleId: string,
  result: SaleAttentionResult,
): DetailAttentionRow[] {
  const rows = result.items.map((item) => mapSaleAttentionItemToRow(saleId, item));

  if (result.truncated) {
    const hiddenCount = result.totalCount - result.items.length;
    if (hiddenCount > 0) {
      rows.push({
        id: "attention-truncated",
        title: `${hiddenCount} more ${word(hiddenCount, "item", "items")} need attention`,
        count: hiddenCount,
        category: "Overview",
        severity: "medium",
        actionLabel: "View overview",
        iconKind: "general",
        href: saleDetailTabHref(saleId, "overview"),
      });
    }
  }

  return rows;
}
