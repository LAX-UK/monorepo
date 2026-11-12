import { type Static, Type } from "@sinclair/typebox";

const DateTime = Type.String({ format: "date-time" });
const NullableDateTime = Type.Union([DateTime, Type.Null()]);
const Mode = Type.Union([Type.Literal("off"), Type.Literal("dry_run"), Type.Literal("live")]);
const RunMode = Type.Union([Type.Literal("dry_run"), Type.Literal("live")]);

export const ADMIN_ZOHO_DRIFT_PAGE_SIZE = 25;

/** The three lists of artworks where Zoho and LAX disagree. */
export const ZOHO_DRIFT_LISTS = [
  "register_without_product",
  "product_without_register",
  "status_mismatch",
] as const;
export type ZohoDriftList = (typeof ZOHO_DRIFT_LISTS)[number];

/**
 * `ok`: refreshing works. `warning`: it has failed once, or has not succeeded for a day while the
 * sync is on. `failing`: it has failed twice in a row. `unknown`: nothing recorded yet.
 */
export const ZOHO_TOKEN_STATUSES = ["ok", "warning", "failing", "unknown"] as const;

export const AdminZohoSyncHealthSchema = Type.Object({
  /** Null until the worker has reported its modes once. */
  modes: Type.Union([
    Type.Object({ artworkSync: Mode, listing: Mode, reportedAt: DateTime }),
    Type.Null(),
  ]),
  /** True when no Zoho sync runs: modes unreported or both off. The tab says so and shows no figures. */
  zohoOff: Type.Boolean(),
  /** The newest nightly pass that reads Zoho Products; null before the first. */
  inbound: Type.Object({
    run: Type.Union([
      Type.Object({
        mode: RunMode,
        finishedAt: DateTime,
        seen: Type.Integer({ minimum: 0 }),
        /** Added or updated in LAX; in a dry run, what would have been. */
        changed: Type.Integer({ minimum: 0 }),
        /** Products the pass could not take in, test artists not counted. */
        leftOut: Type.Integer({ minimum: 0 }),
        conflicts: Type.Integer({ minimum: 0 }),
      }),
      Type.Null(),
    ]),
  }),
  /** The newest nightly pass of the LAX listing and Status on Zoho Products. */
  listing: Type.Object({
    run: Type.Union([
      Type.Object({
        mode: RunMode,
        finishedAt: DateTime,
        checked: Type.Integer({ minimum: 0 }),
        /** Drift found: corrected in Zoho, or in a dry run, would have been. */
        drift: Type.Integer({ minimum: 0 }),
        failed: Type.Integer({ minimum: 0 }),
      }),
      Type.Null(),
    ]),
  }),
  outbound: Type.Object({
    depth: Type.Integer({ minimum: 0 }),
    oldestPendingAt: NullableDateTime,
    deadLettered: Type.Integer({ minimum: 0 }),
  }),
  token: Type.Object({
    status: Type.Union(ZOHO_TOKEN_STATUSES.map((status) => Type.Literal(status))),
    refreshedAt: NullableDateTime,
    expiresAt: NullableDateTime,
    failureStreak: Type.Integer({ minimum: 0 }),
    lastFailureAt: NullableDateTime,
  }),
  drift: Type.Object({
    registerWithoutProduct: Type.Integer({ minimum: 0 }),
    productsWithoutRegister: Type.Integer({ minimum: 0 }),
    statusMismatch: Type.Integer({ minimum: 0 }),
  }),
});

const PagingSchema = {
  total: Type.Integer({ minimum: 0 }),
  page: Type.Integer({ minimum: 1 }),
  pageSize: Type.Integer({ minimum: 1 }),
};

export const AdminZohoDriftQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })),
});

export const AdminZohoRegisterWithoutProductListSchema = Type.Object({
  items: Type.Array(
    Type.Object({
      registerId: Type.String({ format: "uuid" }),
      stockCode: Type.String(),
      title: Type.String(),
      artistName: Type.String(),
      /** Where the artwork is in LAX now, in the words staff read. */
      place: Type.String(),
      foundAt: DateTime,
    }),
  ),
  ...PagingSchema,
});

export const AdminZohoProductWithoutRegisterListSchema = Type.Object({
  items: Type.Array(
    Type.Object({
      zohoProductId: Type.String(),
      stockCode: Type.Union([Type.String(), Type.Null()]),
      title: Type.Union([Type.String(), Type.Null()]),
      /** Why the check left it out; null when a dry run would add it. */
      reason: Type.Union([Type.String(), Type.Null()]),
      foundAt: DateTime,
    }),
  ),
  ...PagingSchema,
});

export const AdminZohoStatusMismatchListSchema = Type.Object({
  items: Type.Array(
    Type.Object({
      registerId: Type.String({ format: "uuid" }),
      stockCode: Type.String(),
      title: Type.String(),
      artistName: Type.String(),
      place: Type.String(),
      zohoStatus: Type.Union([Type.String(), Type.Null()]),
      expectedStatus: Type.String(),
    }),
  ),
  ...PagingSchema,
});

export type AdminZohoSyncHealth = Static<typeof AdminZohoSyncHealthSchema>;
export type AdminZohoDriftQuery = Static<typeof AdminZohoDriftQuerySchema>;
export type AdminZohoRegisterWithoutProductList = Static<
  typeof AdminZohoRegisterWithoutProductListSchema
>;
export type AdminZohoProductWithoutRegisterList = Static<
  typeof AdminZohoProductWithoutRegisterListSchema
>;
export type AdminZohoStatusMismatchList = Static<typeof AdminZohoStatusMismatchListSchema>;
export type ZohoTokenStatus = (typeof ZOHO_TOKEN_STATUSES)[number];
