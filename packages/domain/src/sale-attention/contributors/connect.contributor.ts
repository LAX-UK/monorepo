import { SALE_CATALOG_ACCESS } from "@auction/types";
import type { SaleAttentionContributor } from "../sale-attention-contributor.js";

export const connectContributor: SaleAttentionContributor = {
  id: "connect",
  requiredCapability: SALE_CATALOG_ACCESS,
  needs: ["connectByLotId", "lots"],
  appliesTo: (status) => status === "draft" || status === "scheduled" || status === "active",
  evaluate(signals) {
    const map = signals.connectRequiredByLotId ?? {};
    const count = Object.values(map).filter(Boolean).length;
    if (count <= 0) return [];
    return [
      {
        id: "connect-required",
        kind: "connect_required",
        category: "Setup",
        severity: "critical",
        count,
        target: { tab: "lots" },
      },
    ];
  },
};
