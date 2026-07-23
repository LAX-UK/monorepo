import { LOTS_ACCESS } from "@auction/types";
import type { SaleAttentionContributor } from "../sale-attention-contributor.js";

export const catalogContributor: SaleAttentionContributor = {
  id: "catalog",
  requiredCapability: LOTS_ACCESS,
  needs: ["lots"],
  appliesTo: (status) => status === "draft" || status === "scheduled",
  evaluate(signals) {
    const items = [];
    const incomplete = signals.incompleteCatalogLotCount ?? 0;
    const missingPhotos = signals.draftLotsMissingPhotosCount ?? 0;
    const pastStart = signals.draftLotsPastStartCount ?? 0;

    if (incomplete > 0) {
      items.push({
        id: "incomplete-catalog",
        kind: "incomplete_catalog_lots" as const,
        category: "Catalog" as const,
        severity: "high" as const,
        count: incomplete,
        target: { tab: "lots" as const },
      });
    }
    if (missingPhotos > 0) {
      items.push({
        id: "missing-photos",
        kind: "draft_lots_missing_photos" as const,
        category: "Catalog" as const,
        severity: "high" as const,
        count: missingPhotos,
        target: { tab: "lots" as const },
      });
    }
    if (pastStart > 0) {
      items.push({
        id: "past-start",
        kind: "draft_lots_past_start" as const,
        category: "Catalog" as const,
        severity: "critical" as const,
        count: pastStart,
        target: { tab: "lots" as const },
      });
    }
    return items;
  },
};
