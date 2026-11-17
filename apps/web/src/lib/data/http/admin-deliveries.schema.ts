import { DELIVERY_QUOTE_STATUSES, DELIVERY_STATUSES } from "@auction/domain";
import { z } from "zod";

/** What the staff Deliveries routes answer with. Browser-safe: no server-only imports. */
const fulfilmentStatus = z.enum([
  "awaiting_payment",
  "awaiting_release",
  "released",
  "ready_for_collection",
  "in_transit",
  "delivered",
  "cancelled",
]);

export const deliveryEventSchema = z.object({
  kind: z.enum([
    "requested",
    "quoted",
    "accepted",
    "withdrawn",
    "dispatched",
    "delivered",
    "collected",
    "cancelled",
  ]),
  /** Null when nothing records the time (dispatch, delivery and cancellation keep none). */
  at: z.string().nullable(),
  by: z.enum(["buyer", "staff"]),
});
export type DeliveryEvent = z.infer<typeof deliveryEventSchema>;

export const deliveryViewSchema = z.object({
  lotId: z.string(),
  quoteId: z.string(),
  status: z.enum(DELIVERY_STATUSES),
  closedReason: z.enum(["withdrawn", "cancelled", "collected"]).nullable(),
  awaitingPayment: z.boolean(),
  /** Null when no recorded event time says when the delivery reached its status. */
  statusSince: z.string().nullable(),
  destination: z.string(),
  quote: z.object({
    status: z.enum(DELIVERY_QUOTE_STATUSES),
    amountMinor: z.number().nullable(),
    currency: z.string(),
    note: z.string().nullable(),
    requestedAt: z.string(),
    quotedAt: z.string().nullable(),
    decidedAt: z.string().nullable(),
  }),
  lot: z.object({
    title: z.string(),
    lotNumber: z.number().nullable(),
    imageUrl: z.string().nullable(),
    dimensions: z.string().nullable(),
    hammerMinor: z.number(),
  }),
  sale: z.object({ id: z.string(), title: z.string(), endsAt: z.string() }).nullable(),
  buyer: z.object({
    legalEntityId: z.string(),
    name: z.string(),
    paddleNumber: z.number().nullable(),
  }),
  fulfilment: z
    .object({
      status: fulfilmentStatus,
      method: z.enum(["collection", "shipping"]).nullable(),
      carrier: z.string().nullable(),
      trackingNumber: z.string().nullable(),
      paidAt: z.string().nullable(),
      collectedAt: z.string().nullable(),
    })
    .nullable(),
  history: z.array(deliveryEventSchema),
});
export type DeliveryView = z.infer<typeof deliveryViewSchema>;

const counts = z.object(
  Object.fromEntries(DELIVERY_STATUSES.map((status) => [status, z.number()])) as Record<
    (typeof DELIVERY_STATUSES)[number],
    z.ZodNumber
  >,
);

export const deliveriesPageSchema = z.object({
  items: z.array(deliveryViewSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
  counts,
  sales: z.array(z.object({ id: z.string(), title: z.string() })),
});
export type DeliveriesPage = z.infer<typeof deliveriesPageSchema>;

export const deliveriesSummarySchema = z.object({ waitingCount: z.number() });
