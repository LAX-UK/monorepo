import { z } from "zod";

export const TELEPHONE_BOOKING_NOTES_MAX = 2000;
export const TELEPHONE_BOOKING_CANCELLATION_REASON_MAX = 500;

export const telephoneBookingStatusSchema = z.enum([
  "requested",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
]);

export const createTelephoneBookingBodySchema = z.object({
  buyerLegalEntityId: z.string().uuid(),
  lotIds: z.array(z.string().uuid()).max(50).optional(),
  authorizedMax: z.coerce.number().finite().positive().max(1e12).optional(),
  buyerNotes: z.string().max(TELEPHONE_BOOKING_NOTES_MAX).optional(),
});

export type CreateTelephoneBookingBody = z.infer<typeof createTelephoneBookingBodySchema>;

export const addTelephoneBookingLotsBodySchema = z.object({
  lotIds: z.array(z.string().uuid()).min(1).max(50),
});

export type AddTelephoneBookingLotsBody = z.infer<typeof addTelephoneBookingLotsBodySchema>;

export const telephoneBookingLimitIncreaseBodySchema = z.object({
  amount: z.coerce.number().finite().positive().max(1e12),
});

export type TelephoneBookingLimitIncreaseBody = z.infer<
  typeof telephoneBookingLimitIncreaseBodySchema
>;

export const telephoneBookingCancelBodySchema = z.object({
  reason: z.string().max(TELEPHONE_BOOKING_CANCELLATION_REASON_MAX).optional(),
});

export type TelephoneBookingCancelBody = z.infer<typeof telephoneBookingCancelBodySchema>;

export const adminTelephoneBookingAssignClerkBodySchema = z.object({
  clerkUserId: z.string().min(1).max(191),
});

export type AdminTelephoneBookingAssignClerkBody = z.infer<
  typeof adminTelephoneBookingAssignClerkBodySchema
>;

export const adminTelephoneBookingNotesBodySchema = z.object({
  notes: z.string().max(TELEPHONE_BOOKING_NOTES_MAX),
});

export type AdminTelephoneBookingNotesBody = z.infer<typeof adminTelephoneBookingNotesBodySchema>;

export const adminTelephoneBookingStartLineBodySchema = z.object({
  lotId: z.string().uuid(),
});

export type AdminTelephoneBookingStartLineBody = z.infer<
  typeof adminTelephoneBookingStartLineBodySchema
>;

export const adminTelephoneBookingCompleteLineBodySchema = z.object({
  lotId: z.string().uuid(),
});

export type AdminTelephoneBookingCompleteLineBody = z.infer<
  typeof adminTelephoneBookingCompleteLineBodySchema
>;

export const telephoneBookingIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const saleTelephoneBookingListQuerySchema = z.object({
  status: telephoneBookingStatusSchema.optional(),
});
