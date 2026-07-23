import { FINANCE_ACCESS } from "@auction/types";
import type { SaleAttentionContributor } from "../sale-attention-contributor.js";

export const financeContributor: SaleAttentionContributor = {
  id: "finance",
  requiredCapability: FINANCE_ACCESS,
  needs: ["finance"],
  appliesTo: (status) => status === "ended" || status === "cancelled",
  evaluate(signals) {
    const count = signals.financeReviewCount ?? 0;
    if (count <= 0) return [];
    return [
      {
        id: "finance-review",
        kind: "finance_review",
        category: "Finance",
        severity: "high",
        count,
        target: { external: "/admin/payments?manualReview=1" },
      },
    ];
  },
};
