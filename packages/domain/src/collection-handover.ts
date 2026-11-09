/** Handing works over at the desk. */
/** The photo ID types staff can record. The number and a copy are never kept. */
export const COLLECTION_ID_TYPES = [
  "passport",
  "driving_licence",
  "national_identity_card",
  "other_photo_id",
] as const;
export type CollectionIdType = (typeof COLLECTION_ID_TYPES)[number];

/**
 * The fulfilment statuses a lot can be handed over from: staff have released the work, and it is
 * either still released or already marked ready for collection. One list, used by the desk and by
 * Lot fulfilment, so the two cannot disagree about what may be handed over.
 */
export const HAND_OVER_FROM_STATUSES = ["released", "ready_for_collection"] as const;
export type HandOverFromStatus = (typeof HAND_OVER_FROM_STATUSES)[number];

export function isHandOverFromStatus(
  status: string | null | undefined,
): status is HandOverFromStatus {
  return HAND_OVER_FROM_STATUSES.some((known) => known === status);
}

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
