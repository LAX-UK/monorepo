import { SALE_CATALOG_ACCESS } from "@auction/types";
import { evaluateSalePublishReadiness, rollupLotReadinessFailures } from "../../sale-readiness.js";
import type { SaleAttentionContributor } from "../sale-attention-contributor.js";
import type { SaleAttentionItem } from "../sale-attention-types.js";

const CHECK_TO_KIND: Record<string, SaleAttentionItem["kind"]> = {
  lots: "setup_readiness",
  schedule: "setup_readiness",
  registrations: "pending_registrations",
  venue: "setup_readiness",
  sale_start_future: "setup_readiness",
  images: "draft_lots_missing_photos",
  description: "incomplete_catalog_lots",
  seller: "connect_required",
  artist: "incomplete_catalog_lots",
  schedule_lot: "incomplete_catalog_lots",
};

function severityForCheck(
  checkId: string,
  saleSeverity: "required" | "warning",
): SaleAttentionItem["severity"] {
  if (checkId === "registrations") return "high";
  return saleSeverity === "required" ? "critical" : "high";
}

export const setupReadinessContributor: SaleAttentionContributor = {
  id: "setup-readiness",
  requiredCapability: SALE_CATALOG_ACCESS,
  needs: ["sale", "lots", "connectByLotId"],
  appliesTo: (status) => status === "draft",
  evaluate(signals) {
    const sale = signals.sale;
    const lots = signals.lots ?? [];
    if (!sale) return [];

    const saleChecks = evaluateSalePublishReadiness({
      sale,
      lotCount: lots.length,
      pendingRegistrationCount: signals.pendingRegistrationCount ?? null,
      venueReady: signals.venueReady ?? true,
      startInFuture: signals.startInFuture ?? true,
    });

    const items: SaleAttentionItem[] = [];

    for (const check of saleChecks) {
      if (check.ok) continue;
      items.push({
        id: `setup-sale-${check.id}`,
        kind: CHECK_TO_KIND[check.id] ?? "setup_readiness",
        category: check.id === "registrations" ? "Bidders" : "Setup",
        severity: severityForCheck(check.id, check.severity),
        count: check.id === "registrations" ? (signals.pendingRegistrationCount ?? 1) : 1,
        target: {
          tab:
            check.id === "lots"
              ? "lots"
              : check.id === "registrations"
                ? "registrations"
                : check.id === "schedule" ||
                    check.id === "sale_start_future" ||
                    check.id === "venue"
                  ? "schedule"
                  : "overview",
        },
      });
    }

    const rollups = rollupLotReadinessFailures(lots, signals.connectRequiredByLotId ?? {});

    for (const rollup of rollups) {
      const kind = CHECK_TO_KIND[rollup.checkId] ?? "incomplete_catalog_lots";
      items.push({
        id: `setup-lot-${rollup.checkId}`,
        kind,
        category: rollup.checkId === "seller" ? "Setup" : "Catalog",
        severity: rollup.checkId === "seller" ? "critical" : "high",
        count: rollup.count,
        target: { tab: rollup.checkId === "images" ? "lots" : "lots" },
      });
    }

    return items;
  },
};
