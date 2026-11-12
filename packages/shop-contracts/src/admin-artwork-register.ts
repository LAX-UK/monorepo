import { type Static, Type } from "@sinclair/typebox";
import { AdminCatalogueChangeSchema } from "./admin-catalogue-change.js";
import {
  AdminLaxArtListingSchema,
  AdminLaxArtOfferBlockerSchema,
} from "./admin-offer-on-lax-art.js";
import { AdminWhereItIsSchema } from "./admin-where-it-is.js";

/**
 * The places the All tab can filter by, in the order the filter lists them. A draft lot in LAX Bid
 * is not among them: that draft lives in LAX Bid, so only the record page can show it.
 */
export const REGISTER_PLACE_VALUES = [
  "not_offered",
  "draft_lax_art",
  "lax_art",
  "bid_sale",
  "private_sale",
  "withdrawn",
  "sold",
] as const;
const PlaceSchema = Type.Union(REGISTER_PLACE_VALUES.map((place) => Type.Literal(place)));

/** What a record can still lack before it is offered anywhere. */
export const REGISTER_GAP_VALUES = ["image", "size", "medium"] as const;
const GapSchema = Type.Union(REGISTER_GAP_VALUES.map((gap) => Type.Literal(gap)));

export const ADMIN_REGISTER_PAGE_SIZE = 25;

/** One artwork in the register, as the queues list it. */
export const AdminRegisterArtworkSummarySchema = Type.Object({
  registerId: Type.String({ format: "uuid" }),
  /** The Zoho Product, for "Edit in Zoho". */
  zohoProductId: Type.String(),
  title: Type.String(),
  artistName: Type.String(),
  artistCode: Type.String(),
  stockCode: Type.String(),
  kind: Type.Union([Type.Literal("original"), Type.Literal("print")]),
  /** The Zoho module the record lives in, for "Edit in Zoho". */
  zohoModule: Type.Union([Type.Literal("Products"), Type.Literal("Print_Products")]),
  missing: Type.Array(GapSchema),
  /** When Zoho last changed the Product. */
  zohoModifiedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
});

export const AdminRegisterQueueQuerySchema = Type.Object({
  /** The artist part of the stock code. */
  artist: Type.Optional(Type.String({ minLength: 1, maxLength: 20 })),
  missing: Type.Optional(GapSchema),
  /** The All tab only: where the artwork is. */
  place: Type.Optional(PlaceSchema),
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

/** One artwork in the All tab: the summary and where it is, as the record draws it. */
export const AdminRegisterAllItemSchema = Type.Composite([
  AdminRegisterArtworkSummarySchema,
  Type.Object({ whereItIs: Type.Pick(AdminWhereItIsSchema, ["key", "chip"]) }),
]);

export const AdminRegisterAllListSchema = Type.Object({
  items: Type.Array(AdminRegisterAllItemSchema),
  /** Every artist with a record, for the artist filter. */
  artists: Type.Array(
    Type.Object({ code: Type.String(), name: Type.String(), count: Type.Integer() }),
  ),
  /** Each place with its words and how many records are there, for the Where it is filter. */
  places: Type.Array(
    Type.Object({ value: PlaceSchema, label: Type.String(), count: Type.Integer() }),
  ),
  ...PagingSchema,
});

/** The two queues' sizes, for the Overview. */
export const AdminRegisterCountsSchema = QueueCountsSchema;

const ConflictFieldSchema = Type.Union([
  Type.Literal("stockCode"),
  Type.Literal("kind"),
  Type.Literal("sourceOriginalId"),
  Type.Literal("offerState"),
  Type.Literal("catalogueStatus"),
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
  /** Whether Zoho's value can be taken over. Where an artwork is offered is set in LAX only. */
  canAcceptZoho: Type.Boolean(),
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
  /** The other direction: the LAX listing LAX keeps on each Zoho Product. */
  listing: Type.Object({
    /** Null before the first nightly pass. */
    run: Type.Union([
      Type.Object({
        mode: Type.Union([Type.Literal("dry_run"), Type.Literal("live")]),
        finishedAt: Type.String({ format: "date-time" }),
        checked: Type.Integer({ minimum: 0 }),
        /** Corrected in Zoho, or in a dry run, would have been. */
        changed: Type.Integer({ minimum: 0 }),
        unchanged: Type.Integer({ minimum: 0 }),
        failed: Type.Integer({ minimum: 0 }),
        /** The first failures; `failed` holds the count. */
        failures: Type.Array(
          Type.Object({
            registerId: Type.String(),
            stockCode: Type.Optional(Type.String()),
            code: Type.String(),
            /** Where the record is in LAX now, for a Product deleted in Zoho. */
            place: Type.Optional(Type.String()),
          }),
        ),
      }),
      Type.Null(),
    ]),
    /** Status and listing writes that gave up after their retries, waiting for a person. */
    failedDeliveries: Type.Integer({ minimum: 0 }),
  }),
});

export const AdminRegisterEventSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  type: Type.String(),
  /** `zoho`, `system` or `staff`. */
  actor: Type.Union([Type.Literal("zoho"), Type.Literal("system"), Type.Literal("staff")]),
  /** The staff member's name, when the actor is staff and a name is known. */
  actorName: Type.Union([Type.String(), Type.Null()]),
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
  /** The Zoho module the record lives in, for "Edit in Zoho". */
  zohoModule: Type.Union([Type.Literal("Products"), Type.Literal("Print_Products")]),
  title: Type.String(),
  artistName: Type.String(),
  artistCode: Type.String(),
  medium: Type.Union([Type.String(), Type.Null()]),
  dimensions: Type.Union([Type.String(), Type.Null()]),
  year: Type.Union([Type.Integer(), Type.Null()]),
  imageCount: Type.Integer({ minimum: 0 }),
  catalogueStatus: Type.Union([Type.String(), Type.Null()]),
  /** Zoho's price in pounds ("250.00"), shown beside the LAX price; null when Zoho has none. Information only. */
  zohoPrice: Type.Union([Type.String(), Type.Null()]),
  offerState: Type.String(),
  /** Where it is, drawn the same on every page (see `deriveWhereItIs`). */
  whereItIs: AdminWhereItIsSchema,
  /** The lax.art listing made from this record; null when there is none. */
  laxArt: Type.Union([AdminLaxArtListingSchema, Type.Null()]),
  /** Why it cannot go on lax.art now, most important first; empty when it can. */
  offerBlockers: Type.Array(AdminLaxArtOfferBlockerSchema),
  /** Where the lax.art listing or Bid lot made from this record no longer matches Zoho; empty when none differ. */
  catalogueChanges: Type.Array(AdminCatalogueChangeSchema),
  /** Why it cannot be offered at auction now, most important first; empty when it can. */
  auctionBlockers: Type.Array(AdminLaxArtOfferBlockerSchema),
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
export type AdminRegisterPlace = (typeof REGISTER_PLACE_VALUES)[number];
export type AdminRegisterAllItem = Static<typeof AdminRegisterAllItemSchema>;
export type AdminRegisterAllList = Static<typeof AdminRegisterAllListSchema>;
export type AdminRegisterCounts = Static<typeof AdminRegisterCountsSchema>;
export type AdminRegisterConflict = Static<typeof AdminRegisterConflictSchema>;
export type AdminRegisterConflictItem = Static<typeof AdminRegisterConflictItemSchema>;
export type AdminRegisterConflictList = Static<typeof AdminRegisterConflictListSchema>;
export type AdminRegisterLastCheck = Static<typeof AdminRegisterLastCheckSchema>;
export type AdminRegisterEvent = Static<typeof AdminRegisterEventSchema>;
export type AdminRegisterDetail = Static<typeof AdminRegisterDetailSchema>;
export type AdminRegisterResolveBody = Static<typeof AdminRegisterResolveBodySchema>;
export type AdminRegisterResolveResult = Static<typeof AdminRegisterResolveResultSchema>;
