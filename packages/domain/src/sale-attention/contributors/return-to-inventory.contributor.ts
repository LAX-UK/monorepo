import { LOTS_ACCESS } from "@auction/types";
import type { SaleAttentionContributor } from "../sale-attention-contributor.js";

export const returnToInventoryContributor: SaleAttentionContributor = {
  id: "return-to-inventory",
  requiredCapability: LOTS_ACCESS,
  needs: ["lots"],
  appliesTo: (status) => status === "cancelled",
  evaluate(signals) {
    const count = signals.returnToInventoryEligibleCount ?? 0;
    if (count <= 0) return [];
    return [
      {
        id: "return-inventory",
        kind: "return_to_inventory",
        category: "Catalog",
        severity: "medium",
        count,
        target: { tab: "lots" },
      },
    ];
  },
};
