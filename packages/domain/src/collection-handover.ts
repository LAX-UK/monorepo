/** Handing works over at the desk. */
/** The photo ID types staff can record. The number and a copy are never kept. */
export const COLLECTION_ID_TYPES = [
  "passport",
  "driving_licence",
  "national_identity_card",
  "other_photo_id",
] as const;
export type CollectionIdType = (typeof COLLECTION_ID_TYPES)[number];

export type HandOverLot = { lotId: string; released: boolean };

export type HandOverRefusal =
  | "no_lots"
  /** At least one ticked lot has not been released by staff. */
  | "not_released"
  /** Staff have not confirmed the photo ID check. */
  | "id_not_checked";

/** Whether the ticked lots can be handed over: each released, and the photo ID checked. */
export function handOverRefusal(input: {
  lots: readonly HandOverLot[];
  idChecked: boolean;
}): HandOverRefusal | null {
  if (input.lots.length === 0) return "no_lots";
  if (input.lots.some((lot) => !lot.released)) return "not_released";
  return input.idChecked ? null : "id_not_checked";
}
