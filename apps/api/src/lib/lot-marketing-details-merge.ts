import type { LotMarketingDetails } from "@auction/types";
import type { UpdateLotMarketingDetailsInput } from "@auction/validators";

const MANAGED_KEYS = [
  "sellerArtistId",
  "conditionReport",
  "provenance",
  "exhibitions",
  "imageAlts",
  "artistNote",
] as const satisfies readonly (keyof UpdateLotMarketingDetailsInput)[];

/** Merge a partial marketing patch into existing JSON. `null` clears a key; `undefined` leaves it unchanged.
 * Preserves keys not in the patch (e.g. estimate).
 */
export function mergeLotMarketingDetailsPatch(
  current: LotMarketingDetails,
  patch: UpdateLotMarketingDetailsInput,
): LotMarketingDetails {
  const out: Record<string, unknown> = { ...current };
  for (const k of MANAGED_KEYS) {
    const v = patch[k];
    if (v === undefined) continue;
    if (v === null) {
      delete out[k];
    } else {
      out[k] = v;
    }
  }
  return out as LotMarketingDetails;
}
