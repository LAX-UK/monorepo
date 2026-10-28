import { type Static, Type } from "@sinclair/typebox";

/**
 * Staff contracts for edition runs: the run an artwork sells (LAX standard, custom limited, open,
 * proof or companion), the facts staff confirm about it, open edition stock and linked listings.
 * The shapes match the shop domain's `EditionRunSpec` and `EditionFacts`, so LAX Admin can build
 * the "Shoppers will see" preview from the same describer the storefront uses.
 */

/** A custom limited run holds 2 to 500 prints. */
export const EDITION_RUN_MIN_SIZE = 2;
export const EDITION_RUN_MAX_SIZE = 500;
/** The most prints one stock batch adds to an open edition. */
export const STOCK_BATCH_MAX = 500;
export const STOCK_LOCATION_MAX_LENGTH = 200;
export const FACTS_REASON_MAX_LENGTH = 500;
export const CERTIFICATE_WEEKS_MAX = 52;

const Count = (maximum = EDITION_RUN_MAX_SIZE) => Type.Integer({ minimum: 0, maximum });

/** Wide bounds: the run rules (and their wording) are checked by the shop domain, not here. */
const AllocationCount = () => Type.Integer({ minimum: 0, maximum: 100_000 });

export const AdminRunAllocationSchema = Type.Object(
  { buyer: AllocationCount(), artist: AllocationCount(), lax: AllocationCount() },
  { additionalProperties: false },
);

export const AdminProofsKeptSchema = Type.Object(
  { ap: Count(), pp: Count(), hc: Count(), bat: Count() },
  { additionalProperties: false },
);
export type AdminProofsKept = Static<typeof AdminProofsKeptSchema>;

export const AdminProofTypeSchema = Type.Union([
  Type.Literal("ap"),
  Type.Literal("pp"),
  Type.Literal("hc"),
]);
export type AdminProofType = Static<typeof AdminProofTypeSchema>;

/** What staff choose for a main run. Whether buyer prints are allowed follows the linked original. */
export const AdminMainRunInputSchema = Type.Union([
  Type.Object({ type: Type.Literal("lax_standard") }, { additionalProperties: false }),
  Type.Object(
    {
      type: Type.Literal("custom_limited"),
      size: Type.Integer({ minimum: 0, maximum: 100_000 }),
      allocation: AdminRunAllocationSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal("open"),
      /** The artist's share of new stock, in whole percent; LAX holds the rest. */
      defaultArtistPct: Type.Integer({ minimum: 0, maximum: 100 }),
    },
    { additionalProperties: false },
  ),
]);
export type AdminMainRunInput = Static<typeof AdminMainRunInputSchema>;

export const AdminStockCustodySchema = Type.Union([
  Type.Literal("unprinted"),
  Type.Literal("stored"),
]);

/** One addition of prints to an open edition: who holds them and whether they are printed yet. */
export const AdminStockBatchInputSchema = Type.Object(
  {
    artistCount: Count(STOCK_BATCH_MAX),
    laxCount: Count(STOCK_BATCH_MAX),
    custody: AdminStockCustodySchema,
    storageLocation: Type.Optional(
      Type.Union([Type.String({ maxLength: STOCK_LOCATION_MAX_LENGTH }), Type.Null()]),
    ),
  },
  { additionalProperties: false },
);
export type AdminStockBatchInput = Static<typeof AdminStockBatchInputSchema>;

const SignatureMediumSchema = Type.Union([Type.Literal("pencil"), Type.Literal("ink")]);
const SignaturePlaceSchema = Type.Union([Type.Literal("front_lower_margin"), Type.Literal("back")]);

export const AdminSignatureSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal("hand_signed"),
      medium: SignatureMediumSchema,
      place: SignaturePlaceSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object({ kind: Type.Literal("plate_signed") }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal("estate_stamped") }, { additionalProperties: false }),
  Type.Object(
    { kind: Type.Literal("estate_signed"), place: SignaturePlaceSchema },
    { additionalProperties: false },
  ),
  Type.Object({ kind: Type.Literal("unsigned") }, { additionalProperties: false }),
]);

export const AdminCertificateSchema = Type.Union([
  Type.Object({ kind: Type.Literal("none") }, { additionalProperties: false }),
  Type.Object(
    {
      kind: Type.Literal("included"),
      issuer: Type.Union([Type.Literal("artist"), Type.Literal("publisher"), Type.Literal("lax")]),
      form: Type.Union([Type.Literal("paper"), Type.Literal("digital"), Type.Literal("both")]),
      arrives: Type.Union([
        Type.Object({ kind: Type.Literal("with_print") }, { additionalProperties: false }),
        Type.Object(
          {
            kind: Type.Literal("separately"),
            withinWeeks: Type.Integer({ minimum: 1, maximum: CERTIFICATE_WEEKS_MAX }),
          },
          { additionalProperties: false },
        ),
      ]),
      numberedToMatch: Type.Boolean(),
      numberedToMatchReason: Type.Optional(Type.String({ maxLength: FACTS_REASON_MAX_LENGTH })),
    },
    { additionalProperties: false },
  ),
]);

/** What is true of every print in the run. Nothing here is free text that reaches a storefront. */
export const AdminEditionFactsSchema = Type.Object(
  {
    numbering: Type.Union([
      Type.Literal("on_print"),
      Type.Literal("on_certificate"),
      Type.Literal("none"),
    ]),
    signature: AdminSignatureSchema,
    certificate: AdminCertificateSchema,
  },
  { additionalProperties: false },
);
export type AdminEditionFacts = Static<typeof AdminEditionFactsSchema>;

/** The run chosen when an artwork is created, with what is known of it so far. */
export const AdminNewRunInputSchema = Type.Object(
  {
    spec: AdminMainRunInputSchema,
    proofsKept: Type.Optional(AdminProofsKeptSchema),
    /** Left out while staff have not recorded the facts; publishing waits for them. */
    facts: Type.Optional(AdminEditionFactsSchema),
    /** "I have checked these facts against the print or the publisher's records". */
    factsConfirmed: Type.Optional(Type.Boolean()),
    /** Open editions only: the prints to start with. */
    firstBatch: Type.Optional(AdminStockBatchInputSchema),
  },
  { additionalProperties: false },
);
export type AdminNewRunInput = Static<typeof AdminNewRunInputSchema>;

/** Changes the run of a draft whose prints have not been offered for sale. */
export const AdminRunUpdateBodySchema = Type.Object(
  {
    spec: AdminMainRunInputSchema,
    proofsKept: AdminProofsKeptSchema,
    /** The artwork's version when the editor opened it. */
    expectedVersion: Type.String({ format: "date-time", maxLength: 40 }),
  },
  { additionalProperties: false },
);
export type AdminRunUpdateBody = Static<typeof AdminRunUpdateBodySchema>;

/** The facts row's own version: null when no facts have been saved for the run yet. */
const FactsVersionSchema = Type.Union([
  Type.String({ format: "date-time", maxLength: 40 }),
  Type.Null(),
]);

export const AdminEditionFactsSaveBodySchema = Type.Object(
  {
    facts: AdminEditionFactsSchema,
    confirmed: Type.Boolean(),
    expectedFactsVersion: FactsVersionSchema,
  },
  { additionalProperties: false },
);
export type AdminEditionFactsSaveBody = Static<typeof AdminEditionFactsSaveBodySchema>;

/** Shop admins only, after a sale: the new facts and why. Orders already paid keep their record. */
export const AdminEditionFactsCorrectBodySchema = Type.Object(
  {
    facts: AdminEditionFactsSchema,
    reason: Type.String({ minLength: 1, maxLength: FACTS_REASON_MAX_LENGTH }),
    expectedFactsVersion: FactsVersionSchema,
  },
  { additionalProperties: false },
);
export type AdminEditionFactsCorrectBody = Static<typeof AdminEditionFactsCorrectBodySchema>;

export const AdminEditionFactsSaveResponseSchema = Type.Object({
  factsVersion: Type.String(),
  confirmed: Type.Boolean(),
});

export const ADMIN_EDITION_FACTS_BULK_MAX = 100;

/** The same facts for several runs at once. Runs with paid orders are left as they are. */
export const AdminEditionFactsBulkBodySchema = Type.Object(
  {
    artworkIds: Type.Array(Type.String({ format: "uuid" }), {
      minItems: 1,
      maxItems: ADMIN_EDITION_FACTS_BULK_MAX,
      uniqueItems: true,
    }),
    facts: AdminEditionFactsSchema,
    confirmed: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type AdminEditionFactsBulkBody = Static<typeof AdminEditionFactsBulkBodySchema>;

export const AdminEditionFactsBulkResponseSchema = Type.Object({
  results: Type.Array(
    Type.Object({
      artworkId: Type.String({ format: "uuid" }),
      outcome: Type.Union([
        Type.Literal("changed"),
        Type.Literal("skipped"),
        Type.Literal("refused"),
        Type.Literal("not_found"),
      ]),
      message: Type.Optional(Type.String()),
    }),
  ),
});
export type AdminEditionFactsBulkResponse = Static<typeof AdminEditionFactsBulkResponseSchema>;

export const AdminStockBatchBodySchema = AdminStockBatchInputSchema;
export type AdminStockBatchBody = AdminStockBatchInput;

export const AdminStockBatchResponseSchema = Type.Object({
  batchId: Type.String({ format: "uuid" }),
  firstStockRef: Type.Integer(),
  quantity: Type.Integer(),
  /** LAX's prints go on sale when they are added; the artist offers theirs. */
  laxPrintsOnSale: Type.Integer({ minimum: 0 }),
});

export const AdminProofListingBodySchema = Type.Object(
  {
    proofType: AdminProofTypeSchema,
    count: Type.Integer({ minimum: 1, maximum: EDITION_RUN_MAX_SIZE }),
    owner: Type.Union([Type.Literal("artist"), Type.Literal("lax")]),
    printPricePence: Type.Optional(Type.Integer({ minimum: 1, maximum: 10_000_000 })),
    /** Hors commerce only: the shop admin's approval to sell proofs not made for sale. */
    horsCommerceApproved: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);
export type AdminProofListingBody = Static<typeof AdminProofListingBodySchema>;

/** Another run of the same image: its own run and facts, the rest copied from the main run. */
export const AdminCompanionListingBodySchema = Type.Object(
  {
    slug: Type.String({ minLength: 1, maxLength: 120, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
    title: Type.String({ minLength: 1, maxLength: 200 }),
    run: AdminNewRunInputSchema,
    printPricePence: Type.Optional(Type.Integer({ minimum: 1, maximum: 10_000_000 })),
  },
  { additionalProperties: false },
);
export type AdminCompanionListingBody = Static<typeof AdminCompanionListingBodySchema>;

export const AdminLinkedListingResponseSchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  slug: Type.String(),
  version: Type.String(),
});

/** The run as stored, in the shop domain's shape. */
const MainSpecSchema = Type.Union([
  Type.Object({ type: Type.Literal("lax_standard") }),
  Type.Object({
    type: Type.Literal("custom_limited"),
    size: Type.Integer(),
    allocation: Type.Object({
      buyer: Type.Integer(),
      artist: Type.Integer(),
      lax: Type.Integer(),
    }),
    linkedToOriginal: Type.Boolean(),
  }),
  Type.Object({
    type: Type.Literal("open"),
    defaultSplit: Type.Object({ artistPct: Type.Integer(), laxPct: Type.Integer() }),
  }),
]);

export const AdminEditionRunSpecSchema = Type.Union([
  ...MainSpecSchema.anyOf,
  Type.Object({
    type: Type.Literal("proof"),
    proofType: AdminProofTypeSchema,
    size: Type.Integer(),
    owner: Type.Union([Type.Literal("artist"), Type.Literal("lax")]),
    mainRunId: Type.String({ format: "uuid" }),
    proofsKeptOnMain: Type.Integer(),
  }),
  Type.Object({
    type: Type.Literal("companion"),
    mainRunId: Type.String({ format: "uuid" }),
    run: MainSpecSchema,
  }),
]);
export type AdminEditionRunSpec = Static<typeof AdminEditionRunSpecSchema>;

const LinkedRunSchema = Type.Object({
  artworkId: Type.String({ format: "uuid" }),
  title: Type.String(),
  spec: AdminEditionRunSpecSchema,
});

export const AdminStockBatchSchema = Type.Object({
  batchId: Type.String({ format: "uuid" }),
  createdAt: Type.String({ format: "date-time" }),
  firstStockRef: Type.Integer(),
  quantity: Type.Integer(),
  artistCount: Type.Integer(),
  laxCount: Type.Integer(),
  custody: AdminStockCustodySchema,
  storageLocation: Type.Union([Type.String(), Type.Null()]),
  addedByName: Type.Union([Type.String(), Type.Null()]),
});
export type AdminStockBatch = Static<typeof AdminStockBatchSchema>;

export const AdminOpenStockSchema = Type.Object({
  onSale: Type.Integer({ minimum: 0 }),
  reserved: Type.Integer({ minimum: 0 }),
  sold: Type.Integer({ minimum: 0 }),
  toPrint: Type.Integer({ minimum: 0 }),
  inStorage: Type.Integer({ minimum: 0 }),
  /** The stock reference the next batch starts at. */
  nextStockRef: Type.Integer({ minimum: 1 }),
  batches: Type.Array(AdminStockBatchSchema),
});
export type AdminOpenStock = Static<typeof AdminOpenStockSchema>;

/** An order already paid for a print of this run, listed when its facts are corrected. */
export const AdminAffectedOrderSchema = Type.Object({
  orderId: Type.String({ format: "uuid" }),
  reference: Type.String(),
  paidAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
});

export const AdminEditionRunDetailSchema = Type.Object({
  spec: AdminEditionRunSpecSchema,
  proofsKept: AdminProofsKeptSchema,
  locks: Type.Object({
    /** A print has been offered for sale: size and allocation are fixed. */
    sizeAndAllocationLocked: Type.Boolean(),
    /** A print has sold: the facts are fixed, except through "Correct edition facts". */
    factsLocked: Type.Boolean(),
  }),
  facts: Type.Union([AdminEditionFactsSchema, Type.Null()]),
  factsConfirmed: Type.Union([
    Type.Object({
      byName: Type.Union([Type.String(), Type.Null()]),
      at: Type.String({ format: "date-time" }),
    }),
    Type.Null(),
  ]),
  factsVersion: FactsVersionSchema,
  /** Orders paid so far; the first 50 are listed. */
  paidOrderCount: Type.Integer({ minimum: 0 }),
  affectedOrders: Type.Array(AdminAffectedOrderSchema),
  /** For a proof or companion listing: the run it belongs to. */
  mainRun: Type.Union([LinkedRunSchema, Type.Null()]),
  /** For a main run: its proof and companion listings. */
  linkedListings: Type.Array(LinkedRunSchema),
  /** Open editions only. */
  stock: Type.Union([AdminOpenStockSchema, Type.Null()]),
});
export type AdminEditionRunDetail = Static<typeof AdminEditionRunDetailSchema>;

/** For the artwork list: enough to label the run and to filter for facts that need review. */
export const AdminArtworkRunSummarySchema = Type.Object({
  spec: AdminEditionRunSpecSchema,
  factsStatus: Type.Union([Type.Literal("confirmed"), Type.Literal("needs_review")]),
  /** Paid orders exist, so the facts can only be corrected by a shop admin. */
  factsLocked: Type.Boolean(),
});
export type AdminArtworkRunSummary = Static<typeof AdminArtworkRunSummarySchema>;
