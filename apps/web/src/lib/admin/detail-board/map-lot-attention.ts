import type { DetailAttentionIconKind, DetailAttentionRow } from "@/lib/admin/detail-board/types";
import { lotDetailTabHref } from "@/lib/admin/lots/lot-detail-routes";
import type { LotAttentionItem, LotAttentionResult } from "@auction/domain";

function word(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

const KIND_COPY: Record<
  LotAttentionItem["kind"],
  { title: (count: number) => string; actionLabel: string }
> = {
  setup_readiness: {
    title: () => "Publish checks incomplete",
    actionLabel: "Continue editing",
  },
  connect_required: {
    title: () => "Seller payout setup required",
    actionLabel: "Review seller",
  },
  missing_photos: {
    title: () => "Catalogue images missing",
    actionLabel: "Add images",
  },
  withdrawal_pending: {
    title: () => "Withdrawal request pending review",
    actionLabel: "Review request",
  },
};

function resolveAttentionHref(lotId: string, item: LotAttentionItem): string | undefined {
  const target = item.target;
  if (!target) return undefined;
  if (target.external) return target.external;
  if (target.tab === "images") return lotDetailTabHref(lotId, "images");
  if (target.tab === "documents") return lotDetailTabHref(lotId, "documents");
  if (target.tab === "bids") return lotDetailTabHref(lotId, "bids");
  return lotDetailTabHref(lotId, "overview");
}

function resolveAttentionIconKind(item: LotAttentionItem): DetailAttentionIconKind {
  switch (item.kind) {
    case "setup_readiness":
    case "connect_required":
      return "setup";
    case "missing_photos":
      return "catalog";
    case "withdrawal_pending":
      return "general";
    default:
      return "general";
  }
}

export function mapLotAttentionItemToRow(
  lotId: string,
  item: LotAttentionItem,
): DetailAttentionRow {
  const copy = KIND_COPY[item.kind] ?? KIND_COPY.setup_readiness;
  const href = resolveAttentionHref(lotId, item);
  return {
    id: item.id,
    title: copy.title(item.count),
    count: item.count,
    category: item.category,
    severity: item.severity,
    actionLabel: copy.actionLabel,
    iconKind: resolveAttentionIconKind(item),
    ...(href ? { href } : {}),
  };
}

export function mapLotAttentionToRows(
  lotId: string,
  result: LotAttentionResult,
): DetailAttentionRow[] {
  const rows = result.items.map((item: LotAttentionItem) => mapLotAttentionItemToRow(lotId, item));
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
        href: lotDetailTabHref(lotId, "overview"),
      });
    }
  }
  return rows;
}
