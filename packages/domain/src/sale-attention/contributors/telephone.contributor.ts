import { SALEROOM_ACCESS } from "@auction/types";
import type { SaleAttentionContributor } from "../sale-attention-contributor.js";

export const telephoneContributor: SaleAttentionContributor = {
  id: "telephone",
  requiredCapability: SALEROOM_ACCESS,
  needs: ["telephoneBookings"],
  appliesTo: (status) => status === "scheduled" || status === "active",
  evaluate(signals) {
    const count = signals.telephoneRequestedCount ?? 0;
    if (count <= 0) return [];
    return [
      {
        id: "telephone-pending",
        kind: "telephone_pending",
        category: "Operations",
        severity: "high",
        count,
        target: { tab: "telephone" },
      },
    ];
  },
};
