import { LOT_FULFILMENT_ACCESS } from "@auction/types";
import type { SaleAttentionContributor } from "../sale-attention-contributor.js";

export const fulfilmentContributor: SaleAttentionContributor = {
  id: "fulfilment",
  requiredCapability: LOT_FULFILMENT_ACCESS,
  needs: ["fulfilment"],
  appliesTo: (status) => status === "ended",
  evaluate(signals) {
    const count = signals.fulfilmentPendingCount ?? 0;
    if (count <= 0) return [];
    return [
      {
        id: "fulfilment-pending",
        kind: "fulfilment_pending",
        category: "Operations",
        severity: "high",
        count,
        target: { external: "/admin/lot-fulfilment" },
      },
    ];
  },
};
