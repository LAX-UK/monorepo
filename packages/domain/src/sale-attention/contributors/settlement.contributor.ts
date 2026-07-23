import { FINANCE_ACCESS } from "@auction/types";
import type { SaleAttentionContributor } from "../sale-attention-contributor.js";

export const settlementContributor: SaleAttentionContributor = {
  id: "settlement",
  requiredCapability: FINANCE_ACCESS,
  needs: ["settlement"],
  appliesTo: (status) => status === "ended" || status === "cancelled",
  evaluate(signals) {
    const items = [];
    const unsettled = signals.unsettledSoldLotCount ?? 0;
    const stale = signals.stalePaymentCount ?? 0;

    if (unsettled > 0) {
      items.push({
        id: "unsettled-sold",
        kind: "unsettled_sold_lots" as const,
        category: "Finance" as const,
        severity: "critical" as const,
        count: unsettled,
        target: { tab: "overview" as const, external: "/admin/payments" },
      });
    }
    if (stale > 0) {
      items.push({
        id: "stale-payments",
        kind: "stale_payments" as const,
        category: "Finance" as const,
        severity: "high" as const,
        count: stale,
        target: { external: "/admin/payments" },
      });
    }
    return items;
  },
};
