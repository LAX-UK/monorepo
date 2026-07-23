import { buildLotPublishReadiness } from "@/lib/admin/catalog-readiness";
import type { AdminTableMoneyDisplay } from "@/lib/admin/format-admin-table-money";
import {
  formatAdminTableMoney,
  formatAdminTableMoneyRange,
} from "@/lib/admin/format-admin-table-money";
import { resolveLotCurrency } from "@/lib/money/currency";
import { lotDotStatusPresentation } from "@/lib/presenters/status/lot-dot-status";
import { formatMoney } from "@/lib/ui/format";
import type { LotStatus, SaleDeliveryMode } from "@auction/types";
import type { DotStatusPillTone } from "@auction/ui";

export type LotCatalogSaleContext = {
  deliveryMode: SaleDeliveryMode;
  startTime: Date;
  endTime: Date;
};

/** Catalog-complete when all required publish checks pass. */
export function isLotCatalogComplete(
  lot: Parameters<typeof buildLotPublishReadiness>[1],
  sale: LotCatalogSaleContext,
): boolean {
  if (lot.status === "cancelled" || lot.status === "voided") {
    return false;
  }
  const readiness = buildLotPublishReadiness(lot.id, lot, { sale });
  return readiness.percent === 100;
}

export function lotStatusTone(
  status: LotStatus,
  winnerId?: string | null | undefined,
): DotStatusPillTone {
  return lotDotStatusPresentation({ status, winnerId, context: "sale-board" }).tone;
}

export function lotStatusLabel(status: LotStatus, winnerId?: string | null | undefined): string {
  return lotDotStatusPresentation({ status, winnerId, context: "sale-board" }).label;
}

export function formatLotEstimateDisplay(lot: {
  marketingDetails?: { estimate?: { low: string; high: string; currency: string } | null };
}): AdminTableMoneyDisplay {
  const estimate = lot.marketingDetails?.estimate;
  if (!estimate?.low || !estimate?.high) return { primary: "—" };
  return formatAdminTableMoneyRange(estimate.low, estimate.high, estimate.currency || "GBP");
}

/** @deprecated Prefer formatLotEstimateDisplay for table cells. */
export function formatLotEstimate(lot: {
  marketingDetails?: { estimate?: { low: string; high: string; currency: string } | null };
}): string {
  return formatLotEstimateDisplay(lot).primary;
}

function toAmount(value: string | null | undefined): number {
  const n = Number.parseFloat(value ?? "");
  return Number.isNaN(n) ? 0 : n;
}

type LotHammerSource = {
  status: LotStatus;
  currentPrice: string;
  startingPrice: string;
  winnerId?: string | null;
  marketingDetails?: Parameters<typeof resolveLotCurrency>[0]["marketingDetails"];
};

/** Status-aware hammer presentation for admin lot list tables. */
export function formatLotHammerForTable(lot: LotHammerSource): AdminTableMoneyDisplay {
  const currency = resolveLotCurrency({
    marketingDetails: lot.marketingDetails ?? null,
  });
  const starting = toAmount(lot.startingPrice);
  const current = toAmount(lot.currentPrice);

  if (lot.status === "cancelled" || lot.status === "voided") {
    return { primary: "—" };
  }

  if (lot.status === "draft" || lot.status === "scheduled") {
    if (starting > 0) {
      return {
        primary: "—",
        secondary: `From ${formatMoney(lot.startingPrice, currency)}`,
      };
    }
    return { primary: "—" };
  }

  if (lot.status === "ended") {
    if (lot.winnerId) {
      return formatAdminTableMoney(lot.currentPrice, currency);
    }
    return { primary: "Unsold" };
  }

  if (lot.status === "active") {
    if (current > starting) {
      return formatAdminTableMoney(lot.currentPrice, currency);
    }
    if (starting > 0) {
      return {
        primary: formatMoney(lot.startingPrice, currency),
        secondary: "No bids yet",
      };
    }
    return formatAdminTableMoney(lot.currentPrice, currency);
  }

  if (!lot.currentPrice?.trim()) return { primary: "—" };
  return formatAdminTableMoney(lot.currentPrice, currency);
}

export function formatLotCurrentValue(lot: { currentPrice: string }): string {
  return formatLotHammerForTable({
    status: "active",
    currentPrice: lot.currentPrice,
    startingPrice: "0",
  }).primary;
}
