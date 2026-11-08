import { z } from "zod";

/** The most lots one collection visit holds (the domain rule `MAX_LOTS_PER_COLLECTION`). */
const MAX_LOTS = 20;

const lotIds = z.array(z.string().uuid()).min(1).max(MAX_LOTS);

/** A time, as an ISO 8601 instant. It must be a real visit start; the server checks it is offered. */
const instant = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value).toISOString());

/** The key a booking attempt is sent with; a repeat of the attempt carries the same one. */
export const COLLECTION_IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,128}$/;

/** Who comes to collect. A third party is authorised by the account holder in the same request. */
export const collectionCollectorSchema = z
  .object({
    kind: z.enum(["self", "member", "third_party"]),
    /** As it appears on their photo ID. */
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().max(254).nullish(),
    company: z.string().trim().max(120).nullish(),
    /** The account holder's written authorisation of a third party. */
    authorised: z.boolean().optional(),
  })
  .strict();
export type CollectionCollectorBody = z.infer<typeof collectionCollectorSchema>;

export const collectionBookingIdParamSchema = z.object({ bookingId: z.string().uuid() });

/**
 * The lots to find times for, as a comma-separated list in the URL. Only the shape is checked
 * here; the count, duplicates and whose they are are the domain's and the service's to refuse.
 */
export const collectionAvailabilityQuerySchema = z.object({
  lots: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    )
    .pipe(z.array(z.string().uuid()).max(MAX_LOTS)),
  /** The booking being moved, so its own place does not make its slot read as full. */
  booking: z.string().uuid().optional(),
});
export type CollectionAvailabilityQuery = z.infer<typeof collectionAvailabilityQuerySchema>;

export const bookCollectionBodySchema = z
  .object({
    lotIds,
    slotStart: instant,
    collector: collectionCollectorSchema,
    idempotencyKey: z.string().regex(COLLECTION_IDEMPOTENCY_KEY),
  })
  .strict();
export type BookCollectionBody = z.infer<typeof bookCollectionBodySchema>;

/** Move a visit, change its lots or who collects. `version` is the booking as the person last read it. */
export const changeCollectionBodySchema = z
  .object({
    version: z.number().int().min(0).max(1_000_000),
    lotIds,
    slotStart: instant,
    collector: collectionCollectorSchema,
  })
  .strict();
export type ChangeCollectionBody = z.infer<typeof changeCollectionBodySchema>;

export const cancelCollectionBodySchema = z
  .object({ version: z.number().int().min(0).max(1_000_000) })
  .strict();
export type CancelCollectionBody = z.infer<typeof cancelCollectionBodySchema>;

/**
 * The desk's hand-over: the lots handed over and the kind of photo ID checked. The kind of ID is
 * required, never the number or a copy; a hand-over without it is refused whoever sends it.
 */
export const handOverCollectionBodySchema = z
  .object({
    lotIds,
    idCheck: z.object({
      type: z.enum(["passport", "driving_licence", "national_identity_card", "other_photo_id"]),
    }),
  })
  .strict();
export type HandOverCollectionBody = z.infer<typeof handOverCollectionBodySchema>;
