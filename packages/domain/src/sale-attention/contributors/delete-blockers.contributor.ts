import { SALES_ACCESS } from "@auction/types";
import type { SaleAttentionContributor } from "../sale-attention-contributor.js";

export const deleteBlockersContributor: SaleAttentionContributor = {
  id: "delete-blockers",
  requiredCapability: SALES_ACCESS,
  needs: ["deleteGuards"],
  appliesTo: (status) => status === "draft" || status === "scheduled",
  evaluate(signals) {
    const blockers = signals.deleteBlockers ?? [];
    return blockers.map((blocker, index) => ({
      id: `delete-blocker-${index}`,
      kind: "delete_blocker" as const,
      category: "Delete" as const,
      severity: "high" as const,
      count: 1,
      target: { tab: "overview" as const },
      refs: [blocker],
    }));
  },
};
