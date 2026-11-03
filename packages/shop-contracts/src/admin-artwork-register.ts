import { type Static, Type } from "@sinclair/typebox";

/** What a record can still lack before it is offered anywhere. */
export const REGISTER_GAP_VALUES = ["image", "size", "medium"] as const;
const GapSchema = Type.Union(REGISTER_GAP_VALUES.map((gap) => Type.Literal(gap)));

export const ADMIN_REGISTER_PAGE_SIZE = 25;

/** One artwork in the register, as the queues list it. */
export const AdminRegisterArtworkSummarySchema = Type.Object({
  registerId: Type.String({ format: "uuid" }),
  title: Type.String(),
  artistName: Type.String(),
  artistCode: Type.String(),
  stockCode: Type.String(),
  kind: Type.Union([Type.Literal("original"), Type.Literal("print")]),
  missing: Type.Array(GapSchema),
  /** When Zoho last changed the Product. */
  zohoModifiedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
});

export const AdminRegisterQueueQuerySchema = Type.Object({
  /** The artist part of the stock code. */
  artist: Type.Optional(Type.String({ minLength: 1, maxLength: 20 })),
  missing: Type.Optional(GapSchema),
  page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })),
});

const QueueCountsSchema = Type.Object({
  new: Type.Integer({ minimum: 0 }),
  decisions: Type.Integer({ minimum: 0 }),
});

const PagingSchema = {
  total: Type.Integer({ minimum: 0 }),
  page: Type.Integer({ minimum: 1 }),
  pageSize: Type.Integer({ minimum: 1 }),
  /** Both queues, before the artist and missing filters. */
  counts: QueueCountsSchema,
};

export const AdminRegisterNewListSchema = Type.Object({
  items: Type.Array(AdminRegisterArtworkSummarySchema),
  artists: Type.Array(
    Type.Object({ code: Type.String(), name: Type.String(), count: Type.Integer() }),
  ),
  ...PagingSchema,
});

const ConflictFieldSchema = Type.Union([
  Type.Literal("stockCode"),
  Type.Literal("kind"),
  Type.Literal("sourceOriginalId"),
  Type.Literal("offerState"),
]);
const ConflictResolutionSchema = Type.Union([
  Type.Literal("kept_lax"),
  Type.Literal("accepted_zoho"),
]);
const ScalarSchema = Type.Union([Type.String(), Type.Null()]);

export const AdminRegisterConflictSchema = Type.Object({
  conflictId: Type.String({ format: "uuid" }),
  field: ConflictFieldSchema,
  zohoValue: ScalarSchema,
  laxValue: ScalarSchema,
  status: Type.Union([Type.Literal("open"), Type.Literal("resolved")]),
  resolution: Type.Union([ConflictResolutionSchema, Type.Null()]),
  resolvedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  /** When Zoho made the change that caused it. */
  zohoModifiedAt: Type.String({ format: "date-time" }),
  detectedAt: Type.String({ format: "date-time" }),
});

export const AdminRegisterConflictItemSchema = Type.Object({
  conflict: AdminRegisterConflictSchema,
  artwork: AdminRegisterArtworkSummarySchema,
});

export const AdminRegisterConflictListSchema = Type.Object({
  items: Type.Array(AdminRegisterConflictItemSchema),
  ...PagingSchema,
});

export const AdminRegisterLastCheckSchema = Type.Object({
  counts: QueueCountsSchema,
  /** Null before the first nightly check has run. */
  run: Type.Union([
    Type.Object({
      mode: Type.Union([Type.Literal("dry_run"), Type.Literal("live")]),
      finishedAt: Type.String({ format: "date-time" }),
      total: Type.Integer({ minimum: 0 }),
      outcomes: Type.Object({
        create: Type.Integer(),
        update: Type.Integer(),
        conflict: Type.Integer(),
        unchanged: Type.Integer(),
        stale: Type.Integer(),
        skipped: Type.Integer(),
      }),
      skippedReasons: Type.Array(Type.Object({ reason: Type.String(), count: Type.Integer() })),
      gaps: Type.Array(Type.Object({ gap: Type.String(), count: Type.Integer() })),
    }),
    Type.Null(),
  ]),
});

export const AdminRegisterEventSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  type: Type.String(),
  /** `zoho`, `system` or `staff`; a staff member is not named here. */
  actor: Type.Union([Type.Literal("zoho"), Type.Literal("system"), Type.Literal("staff")]),
  payload: Type.Record(Type.String(), Type.Unknown()),
  createdAt: Type.String({ format: "date-time" }),
});

export const AdminRegisterParamsSchema = Type.Object({
  registerId: Type.String({ format: "uuid" }),
});

export const AdminRegisterDetailSchema = Type.Object({
  registerId: Type.String({ format: "uuid" }),
  zohoProductId: Type.String(),
  stockCode: Type.String(),
  kind: Type.Union([Type.Literal("original"), Type.Literal("print")]),
  title: Type.String(),
  artistName: Type.String(),
  artistCode: Type.String(),
  medium: Type.Union([Type.String(), Type.Null()]),
  dimensions: Type.Union([Type.String(), Type.Null()]),
  year: Type.Union([Type.Integer(), Type.Null()]),
  imageCount: Type.Integer({ minimum: 0 }),
  catalogueStatus: Type.Union([Type.String(), Type.Null()]),
  offerState: Type.String(),
  missing: Type.Array(GapSchema),
  zohoModifiedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  createdAt: Type.String({ format: "date-time" }),
  conflicts: Type.Array(AdminRegisterConflictSchema),
  events: Type.Array(AdminRegisterEventSchema),
});

export const AdminRegisterConflictParamsSchema = Type.Object({
  conflictId: Type.String({ format: "uuid" }),
});

export const AdminRegisterResolveBodySchema = Type.Object({
  resolution: ConflictResolutionSchema,
});

export const AdminRegisterResolveResultSchema = Type.Object({
  registerId: Type.String({ format: "uuid" }),
  conflict: AdminRegisterConflictSchema,
});

export type AdminRegisterGap = (typeof REGISTER_GAP_VALUES)[number];
export type AdminRegisterArtworkSummary = Static<typeof AdminRegisterArtworkSummarySchema>;
export type AdminRegisterQueueQuery = Static<typeof AdminRegisterQueueQuerySchema>;
export type AdminRegisterNewList = Static<typeof AdminRegisterNewListSchema>;
export type AdminRegisterConflict = Static<typeof AdminRegisterConflictSchema>;
export type AdminRegisterConflictItem = Static<typeof AdminRegisterConflictItemSchema>;
export type AdminRegisterConflictList = Static<typeof AdminRegisterConflictListSchema>;
export type AdminRegisterLastCheck = Static<typeof AdminRegisterLastCheckSchema>;
export type AdminRegisterEvent = Static<typeof AdminRegisterEventSchema>;
export type AdminRegisterDetail = Static<typeof AdminRegisterDetailSchema>;
export type AdminRegisterResolveBody = Static<typeof AdminRegisterResolveBodySchema>;
export type AdminRegisterResolveResult = Static<typeof AdminRegisterResolveResultSchema>;
