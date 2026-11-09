import type {
  DeskBookingView,
  DeskClientLot,
  DeskDayView,
  DeskGroupView,
  DeskListView,
  DeskLotView,
} from "@auction/types";
import { z } from "zod";

/** What the collections desk API sends, read at the boundary. */
const lotSchema = z.object({
  lotId: z.string(),
  title: z.string(),
  lotNumber: z.number().nullable(),
  image: z.string().nullable(),
  released: z.boolean(),
  fulfilmentStatus: z.enum([
    "awaiting_payment",
    "awaiting_release",
    "released",
    "ready_for_collection",
    "in_transit",
    "delivered",
    "cancelled",
    "none",
  ]),
  active: z.boolean(),
  outcome: z.enum(["collected", "left"]).nullable(),
}) satisfies z.ZodType<DeskLotView>;

export const deskBookingSchema = z.object({
  id: z.string(),
  reference: z.string(),
  status: z.enum(["booked", "collected", "partly_collected", "not_collected", "cancelled"]),
  start: z.string(),
  end: z.string(),
  version: z.number().int(),
  buyer: z.object({ id: z.string(), name: z.string() }),
  bookedVia: z.enum(["client", "staff"]),
  overCapacity: z.boolean(),
  collector: z.object({
    kind: z.enum(["self", "member", "third_party"]),
    name: z.string(),
    company: z.string().nullable(),
  }),
  lots: z.array(lotSchema),
  idCheckType: z
    .enum(["passport", "driving_licence", "national_identity_card", "other_photo_id"])
    .nullable(),
  handedOverAt: z.string().nullable(),
  undoUntil: z.string().nullable(),
  actions: z.array(z.enum(["hand_over", "not_collected", "undo", "rebook"])),
  handOverBlocked: z.literal("not_released").nullable(),
}) satisfies z.ZodType<DeskBookingView>;

const groupSchema = z.object({
  start: z.string(),
  end: z.string(),
  taken: z.number().int(),
  capacity: z.number().int(),
  bookings: z.array(deskBookingSchema),
}) satisfies z.ZodType<DeskGroupView>;

export const deskDaySchema = z.object({
  venueId: z.string(),
  date: z.string(),
  state: z.enum(["open", "closed", "sale_day"]),
  canOpenAnyway: z.boolean(),
  capacity: z.number().int(),
  visitMinutes: z.number().int(),
  openTimes: z.number().int(),
  groups: z.array(groupSchema),
  toHandOver: z.number().int(),
  notCollected: z.number().int(),
}) satisfies z.ZodType<DeskDayView>;

export const deskListSchema = z.object({
  venueId: z.string(),
  status: z.enum(["upcoming", "not_collected"]),
  items: z.array(deskBookingSchema),
  more: z.boolean(),
  notCollected: z.number().int(),
}) satisfies z.ZodType<DeskListView>;

export const deskClientLotsSchema = z.object({
  lotId: z.string(),
  title: z.string(),
  lotNumber: z.number().nullable(),
  collectable: z.boolean(),
  blockedMessage: z.string().nullable(),
}) satisfies z.ZodType<DeskClientLot>;
