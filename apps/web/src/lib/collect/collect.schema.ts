import type {
  CollectionAvailability,
  CollectionDayView,
  CollectionLotLine,
  CollectionSlotView,
  CollectionVisitView,
} from "@auction/types";
import { z } from "zod";

/**
 * What the collection API sends, read at the boundary. A body that does not match is "could not be
 * read", never half-drawn: the page then says it could not load the times.
 */
const slotSchema = z.object({
  start: z.string(),
  end: z.string(),
  placesLeft: z.number().int().min(0),
  state: z.enum(["open", "full", "too_soon"]),
}) satisfies z.ZodType<CollectionSlotView>;

const daySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  state: z.enum(["open", "full", "closed", "sale_day", "too_soon"]),
  openSlots: z.number().int().min(0),
  slots: z.array(slotSchema),
}) satisfies z.ZodType<CollectionDayView>;

const lotLineSchema = z.object({
  lotId: z.string(),
  title: z.string(),
  lotNumber: z.number().nullable(),
  collectable: z.boolean(),
  blockedReason: z.string().nullable(),
  blockedMessage: z.string().nullable(),
}) satisfies z.ZodType<CollectionLotLine>;

export const collectionAvailabilitySchema = z.object({
  venueId: z.string(),
  onlineBookingEnabled: z.boolean(),
  bookingEmail: z.string().nullable(),
  visitMinutes: z.number().int().positive(),
  windowDays: z.number().int().positive(),
  noticeCutoffLocal: z.string(),
  timeZone: z.literal("Europe/London"),
  earliest: z.string().nullable(),
  days: z.array(daySchema),
  lots: z.array(lotLineSchema),
}) satisfies z.ZodType<CollectionAvailability>;

export const collectionVisitSchema = z.object({
  id: z.string(),
  reference: z.string(),
  status: z.enum(["booked", "collected", "partly_collected", "not_collected", "cancelled"]),
  start: z.string(),
  end: z.string(),
  version: z.number().int().min(0),
  lots: z.array(
    z.object({
      lotId: z.string(),
      title: z.string(),
      lotNumber: z.number().nullable(),
      active: z.boolean(),
      outcome: z.enum(["collected", "left"]).nullable(),
    }),
  ),
  collector: z.object({
    kind: z.enum(["self", "member", "third_party"]),
    name: z.string(),
    email: z.string().nullable(),
    company: z.string().nullable(),
  }),
  authorisedAt: z.string().nullable(),
  bookedByYou: z.boolean(),
  bookedVia: z.enum(["client", "staff"]),
  noticeDeadline: z.string().nullable(),
  actions: z.array(z.enum(["change", "cancel"])),
  handedOverAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
}) satisfies z.ZodType<CollectionVisitView>;

export const collectionVisitsSchema = z.array(collectionVisitSchema);

/** The refusal body the API sends: a code to switch on and a sentence that can be shown as it is. */
export const collectionRefusalSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  lotId: z.string().optional(),
  reason: z.string().optional(),
  issues: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  bookingEmail: z.string().nullable().optional(),
});
export type CollectionRefusal = z.infer<typeof collectionRefusalSchema>;
