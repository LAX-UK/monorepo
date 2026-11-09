import { z } from "zod";

/**
 * Staff changing a place's collection settings. Only the shape is checked here (types and sizes);
 * the rules (hours in order and not overlapping, the allowed visit lengths and ranges, a real
 * date) belong to the domain, so every refusal comes back with the field it belongs to.
 */

const time = z.string().max(5);
const day = z.string().max(10);

/** What staff chose to happen to the bookings a change leaves outside the place's offer. */
export const affectedBookingsChoiceSchema = z.enum(["keep", "cancel_and_rebook"]);
export type AffectedBookingsChoice = z.infer<typeof affectedBookingsChoiceSchema>;

export const collectionVenueParamSchema = z.object({ venueId: z.string().uuid() });
export const collectionExceptionParamSchema = z.object({
  venueId: z.string().uuid(),
  exceptionId: z.string().uuid(),
});

export const saveCollectionSettingsBodySchema = z
  .object({
    /** The `version` of the settings as staff last read them. */
    version: z.string().datetime({ offset: true }),
    onlineBookingEnabled: z.boolean(),
    visitMinutes: z.number().int(),
    placesPerSlot: z.number().int(),
    noticeCutoffLocal: time,
    noticeWorkingDays: z.number().int(),
    windowDays: z.number().int(),
    closeOnSaleDays: z.boolean(),
    undoHandOverMinutes: z.number().int(),
    maxActiveVisits: z.number().int(),
    freeStorageDays: z.number().int().min(0).max(365).nullable(),
    bookingEmail: z.string().trim().email().max(254).nullable(),
    hours: z
      .array(z.object({ weekday: z.number().int(), opensLocal: time, closesLocal: time }).strict())
      .max(7 * 8),
    affectedBookings: affectedBookingsChoiceSchema.optional(),
  })
  .strict();
export type SaveCollectionSettingsBody = z.infer<typeof saveCollectionSettingsBodySchema>;

export const addCollectionExceptionBodySchema = z
  .object({
    kind: z.enum(["closure", "extra_opening"]),
    startsOn: day,
    endsOn: day,
    opensLocal: time.nullable(),
    closesLocal: time.nullable(),
    /** Staff's own note; never shown to clients. */
    reason: z.string().trim().max(200).nullish(),
    affectedBookings: affectedBookingsChoiceSchema.optional(),
  })
  .strict();
export type AddCollectionExceptionBody = z.infer<typeof addCollectionExceptionBodySchema>;

export const removeCollectionExceptionBodySchema = z
  .object({ affectedBookings: affectedBookingsChoiceSchema.optional() })
  .strict();
export type RemoveCollectionExceptionBody = z.infer<typeof removeCollectionExceptionBodySchema>;
