import { SALEROOM_ACCESS } from "@auction/types";
import type { SaleAttentionContributor } from "../sale-attention-contributor.js";

export const saleroomContributor: SaleAttentionContributor = {
  id: "saleroom",
  requiredCapability: SALEROOM_ACCESS,
  needs: ["saleroomSession"],
  appliesTo: (status) => status === "active" || status === "ended",
  evaluate(signals) {
    if (!signals.saleroomNeedsClosing) return [];
    return [
      {
        id: "saleroom-closing",
        kind: "saleroom_needs_closing",
        category: "Operations",
        severity: "high",
        count: 1,
        target: { external: "/admin/saleroom" },
      },
    ];
  },
};
