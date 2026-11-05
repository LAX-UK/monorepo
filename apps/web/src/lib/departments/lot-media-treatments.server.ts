import "server-only";

import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { type LotMediaTreatmentIndex, buildLotMediaTreatmentIndex } from "@auction/domain";
import { cache } from "react";

/**
 * How each department's lots are shown, keyed by category id, for the pages that draw lot
 * cards or the lot page. Read once per request. A failed read gives an empty index, so every
 * lot is shown as a wall work and the page still loads.
 */
export const getLotMediaTreatments = cache(async (): Promise<LotMediaTreatmentIndex> => {
  try {
    const reader = await getServerCategoryReader();
    return buildLotMediaTreatmentIndex(await reader.list());
  } catch (err) {
    console.error("[getLotMediaTreatments] categories failed", err);
    return {};
  }
});
