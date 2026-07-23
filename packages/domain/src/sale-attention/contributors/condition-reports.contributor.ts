import { CONDITION_REPORTS_ACCESS } from "@auction/types";
import type { SaleAttentionContributor } from "../sale-attention-contributor.js";

export const conditionReportsContributor: SaleAttentionContributor = {
  id: "condition-reports",
  requiredCapability: CONDITION_REPORTS_ACCESS,
  needs: ["conditionReports"],
  appliesTo: () => true,
  evaluate(signals) {
    const count = signals.openConditionReportCount ?? 0;
    if (count <= 0) return [];
    return [
      {
        id: "condition-reports-open",
        kind: "condition_reports_open",
        category: "Operations",
        severity: "medium",
        count,
        target: { external: "/admin/condition-reports" },
      },
    ];
  },
};
