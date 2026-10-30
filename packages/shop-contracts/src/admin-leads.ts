import { type Static, Type } from "@sinclair/typebox";

export const ADMIN_LEAD_SEARCH_MAX_LENGTH = 120;

const LeadStatusSchema = Type.Union([
  Type.Literal("ordered"),
  Type.Literal("abandoned_checkout"),
  Type.Literal("enquired"),
]);
const LeadTabSchema = Type.Union([
  Type.Literal("all"),
  Type.Literal("ordered"),
  Type.Literal("abandoned_checkout"),
  Type.Literal("enquired"),
  Type.Literal("joined"),
]);
const LeadSourceSchema = Type.Union([
  Type.Literal("shop_checkout"),
  Type.Literal("shop_enquiry"),
  Type.Literal("art_enquiry"),
]);
const LeadCrmStateSchema = Type.Union([
  Type.Literal("synced"),
  Type.Literal("pending"),
  Type.Literal("failed"),
  Type.Literal("not_sent"),
]);

export const AdminLeadListQuerySchema = Type.Object({
  tab: Type.Optional(LeadTabSchema),
  q: Type.Optional(Type.String({ maxLength: ADMIN_LEAD_SEARCH_MAX_LENGTH })),
  source: Type.Optional(LeadSourceSchema),
  consent: Type.Optional(Type.Union([Type.Literal("given"), Type.Literal("not_given")])),
  crm: Type.Optional(LeadCrmStateSchema),
  cursor: Type.Optional(Type.String({ maxLength: 200 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});

const LeadConsentSchema = Type.Object({
  given: Type.Boolean(),
  at: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  /** The version of the opt-in wording the guest agreed to. */
  version: Type.Union([Type.String(), Type.Null()]),
});

export const AdminLeadSummarySchema = Type.Object({
  leadId: Type.String({ format: "uuid" }),
  name: Type.Union([Type.String(), Type.Null()]),
  email: Type.String(),
  status: LeadStatusSchema,
  source: LeadSourceSchema,
  firstSeenAt: Type.String({ format: "date-time" }),
  lastSeenAt: Type.String({ format: "date-time" }),
  paidOrderCount: Type.Integer({ minimum: 0 }),
  enquiryCount: Type.Integer({ minimum: 0 }),
  consent: LeadConsentSchema,
  crm: LeadCrmStateSchema,
  /** When the guest's email joined a LAX account; their orders and enquiries moved there. */
  joinedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
});

export const AdminLeadListResponseSchema = Type.Object({
  items: Type.Array(AdminLeadSummarySchema),
  /** Leads per tab, before search and filters. */
  counts: Type.Record(Type.String(), Type.Integer({ minimum: 0 })),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
});

export const AdminLeadParamsSchema = Type.Object({ leadId: Type.String({ format: "uuid" }) });

const LeadOrderSchema = Type.Object({
  orderId: Type.String({ format: "uuid" }),
  reference: Type.String(),
  status: Type.String(),
  totalPence: Type.Integer(),
  createdAt: Type.String({ format: "date-time" }),
  paidAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
});

const LeadEnquirySchema = Type.Object({
  kind: Type.Union([Type.Literal("artwork"), Type.Literal("general")]),
  enquiryId: Type.String({ format: "uuid" }),
  reference: Type.String(),
  /** The work's title for an artwork enquiry, else the topic. */
  subject: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
});

export const AdminLeadDetailSchema = Type.Composite([
  AdminLeadSummarySchema,
  Type.Object({
    phone: Type.Union([Type.String(), Type.Null()]),
    checkoutStartedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    joinedSubjectId: Type.Union([Type.String(), Type.Null()]),
    crmRecord: Type.Union([
      Type.Object({ module: Type.String(), recordId: Type.String() }),
      Type.Null(),
    ]),
    orders: Type.Array(LeadOrderSchema),
    enquiries: Type.Array(LeadEnquirySchema),
  }),
]);

export type AdminLeadListQuery = Static<typeof AdminLeadListQuerySchema>;
export type AdminLeadSummary = Static<typeof AdminLeadSummarySchema>;
export type AdminLeadListResponse = Static<typeof AdminLeadListResponseSchema>;
export type AdminLeadDetail = Static<typeof AdminLeadDetailSchema>;
