import "server-only";

import { getPublicCategories } from "@/lib/data/http/public-catalogue.server";
import { type LotMediaTreatmentIndex, buildLotMediaTreatmentIndex } from "@auction/domain";
import { cache } from "react";

/**
 * How each department's lots are shown, keyed by category id, for the pages that draw lot
 * cards or the lot page. Read once per request. A failed read gives an empty index, so every
 * lot is shown as a wall work and the page still loads. Departments are public, so the read
 * carries no session (the public sale and lot pages are cached, CO-7).
 */
export const getLotMediaTreatments = cache(async (): Promise<LotMediaTreatmentIndex> => {
  return buildLotMediaTreatmentIndex(await getPublicCategories());
});
