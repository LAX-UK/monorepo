import { z } from "zod";
import { COLLECTION_IDEMPOTENCY_KEY, collectionCollectorSchema } from "./collection-booking.js";

const uuid = z.string().uuid();
const instant = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value).toISOString());

export const COLLECTION_ID_TYPE_VALUES = [
  "passport",
  "driving_licence",
  "national_identity_card",
  "other_photo_id",
] as const;

export const collectionDeskVenueParamSchema = z.object({ venueId: uuid });
export const collectionDeskBookingParamSchema = z.object({ bookingId: uuid });

export const collectionDeskDayQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const collectionDeskListQuerySchema = z.object({
  status: z.enum(["upcoming", "not_collected"]),
});

/**
 * A hand-over: the lots handed over (the rest stay), and that staff checked the photo ID against
 * the named collector, with its type. The number and a copy are never sent, so none is kept.
 */
export const collectionDeskHandOverBodySchema = z
  .object({
    lotIds: z.array(uuid).min(1).max(20),
    idCheck: z
      .object({
        confirmed: z.literal(true),
        type: z.enum(COLLECTION_ID_TYPE_VALUES),
      })
      .strict(),
  })
  .strict();
export type CollectionDeskHandOverBody = z.infer<typeof collectionDeskHandOverBodySchema>;

export const collectionDeskNotCollectedBodySchema = z.object({}).strict();
export type CollectionDeskNotCollectedBody = z.infer<typeof collectionDeskNotCollectedBodySchema>;

export const collectionDeskUndoBodySchema = z.object({}).strict();

/** Staff may go over capacity or inside the notice period; that needs a reason, kept with the booking. */
const override = z.object({ reason: z.string().trim().min(3).max(300) }).strict();

export const collectionDeskRebookBodySchema = z
  .object({
    /** The booking as staff last read it (its calendar SEQUENCE). */
    version: z.number().int().min(0),
    slotStart: instant,
    override: override.optional(),
  })
  .strict();
export type CollectionDeskRebookBody = z.infer<typeof collectionDeskRebookBodySchema>;

export const collectionDeskBookForClientBodySchema = z
  .object({
    legalEntityId: uuid,
    lotIds: z.array(uuid).min(1).max(20),
    slotStart: instant,
    collector: collectionCollectorSchema,
    override: override.optional(),
    idempotencyKey: z.string().regex(COLLECTION_IDEMPOTENCY_KEY),
  })
  .strict();
export type CollectionDeskBookForClientBody = z.infer<typeof collectionDeskBookForClientBodySchema>;
