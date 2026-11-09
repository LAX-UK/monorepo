import { type Static, Type } from "@sinclair/typebox";

/**
 * LAX Admin › Orders › Delivery quotes: the requests buyers have sent for delivery outside the UK,
 * and what staff do with them: send a price and carrier, or say the gallery cannot deliver there.
 */
const QuoteStatusSchema = Type.Union([
  Type.Literal("requested"),
  Type.Literal("quoted"),
  Type.Literal("accepted"),
  Type.Literal("withdrawn"),
]);

export const AdminDeliveryQuoteSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  orderId: Type.String({ format: "uuid" }),
  /** "LAX-S-10482". */
  orderReference: Type.String(),
  status: QuoteStatusSchema,
  /** ISO 3166-1 alpha-2, and the name staff read. */
  country: Type.String({ minLength: 2, maxLength: 2 }),
  countryName: Type.String(),
  /** The region name staff read, or null for a country outside the four regions. */
  regionName: Type.Union([Type.String(), Type.Null()]),
  /** Who the delivery is for, as the buyer wrote it. */
  recipientName: Type.Union([Type.String(), Type.Null()]),
  /** The address as one block, for the courier. */
  address: Type.Array(Type.String()),
  phone: Type.Union([Type.String(), Type.Null()]),
  /** One line per print: "Warm Basket". */
  items: Type.Array(Type.String()),
  merchandisePence: Type.Integer({ minimum: 0 }),
  requestedAt: Type.String({ format: "date-time" }),
  /** When the held prints are released if the quote is not paid. */
  holdUntil: Type.String({ format: "date-time" }),
  quote: Type.Union([
    Type.Object({
      pricePence: Type.Integer({ minimum: 1 }),
      carrier: Type.String(),
      service: Type.Union([Type.String(), Type.Null()]),
      leadTimeNote: Type.Union([Type.String(), Type.Null()]),
      quotedAt: Type.String({ format: "date-time" }),
    }),
    Type.Null(),
  ]),
  /** Why a withdrawn request ended: cancelled_by_buyer, cannot_deliver or expired. */
  endReason: Type.Union([
    Type.Literal("cancelled_by_buyer"),
    Type.Literal("cannot_deliver"),
    Type.Literal("expired"),
    Type.Null(),
  ]),
  declineNote: Type.Union([Type.String(), Type.Null()]),
});
export type AdminDeliveryQuote = Static<typeof AdminDeliveryQuoteSchema>;

export const AdminDeliveryQuoteListSchema = Type.Object({
  items: Type.Array(AdminDeliveryQuoteSchema),
  /** Requests waiting for staff: the count shown on the tab and in the nav. */
  waitingCount: Type.Integer({ minimum: 0 }),
  /** Whether buyers can pay a quote yet; staff are told when they cannot. */
  paymentOpen: Type.Boolean(),
});
export type AdminDeliveryQuoteList = Static<typeof AdminDeliveryQuoteListSchema>;

export const AdminDeliveryQuoteViewSchema = Type.Union([
  Type.Literal("waiting"),
  Type.Literal("quoted"),
  Type.Literal("closed"),
]);
export type AdminDeliveryQuoteView = Static<typeof AdminDeliveryQuoteViewSchema>;

export const AdminSendDeliveryQuoteBodySchema = Type.Object(
  {
    /** The price the buyer pays for delivery, insurance included, in whole pence. */
    pricePence: Type.Number(),
    carrier: Type.String({ maxLength: 400 }),
    service: Type.Optional(Type.String({ maxLength: 400 })),
    leadTimeNote: Type.Optional(Type.String({ maxLength: 1000 })),
  },
  { additionalProperties: false },
);
export type AdminSendDeliveryQuoteBody = Static<typeof AdminSendDeliveryQuoteBodySchema>;

export const AdminDeclineDeliveryQuoteBodySchema = Type.Object(
  { note: Type.String({ maxLength: 2000 }) },
  { additionalProperties: false },
);
export type AdminDeclineDeliveryQuoteBody = Static<typeof AdminDeclineDeliveryQuoteBodySchema>;

export const AdminDeliveryQuoteParamsSchema = Type.Object({
  quoteId: Type.String({ format: "uuid" }),
});

const InputIssueSchema = Type.Object({
  field: Type.Union([
    Type.Literal("pricePence"),
    Type.Literal("carrier"),
    Type.Literal("service"),
    Type.Literal("leadTimeNote"),
    Type.Literal("note"),
  ]),
  reason: Type.String(),
});

/** A 400 that names each field of a quote or a decline that needs another look. */
export const AdminDeliveryQuoteRejectedBodySchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.Optional(Type.String()),
  issues: Type.Optional(Type.Array(InputIssueSchema)),
});
