import { type Static, Type } from "@sinclair/typebox";

/**
 * Stock location in LAX Admin: the list of places an original can physically be, and where each
 * artwork is now and has been. Design: docs/design/stock-location.md.
 *
 * The names and notes are checked again by the shared rules in `artwork-register-contracts`
 * (trimmed, counted as Postgres counts characters); the lengths here only stop an oversized body.
 * A move's body is parsed with `moveArtworksRequestSchema` from the same package, so the batch
 * limit is one rule for the route and the store.
 */

const StatusSchema = Type.Union([Type.Literal("active"), Type.Literal("retired")]);

export const AdminStockLocationSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  name: Type.String(),
  note: Type.Union([Type.String(), Type.Null()]),
  status: StatusSchema,
  /** Sent back with a rename, retire or restore, so two people cannot overwrite each other. */
  version: Type.Integer({ minimum: 1 }),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
  retiredAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
});

export const AdminStockLocationListSchema = Type.Object({
  items: Type.Array(AdminStockLocationSchema),
});

export const AdminStockLocationListQuerySchema = Type.Object({
  includeRetired: Type.Optional(Type.Boolean()),
});

export const AdminStockLocationParamsSchema = Type.Object({
  locationId: Type.String({ format: "uuid" }),
});

const RawText = (maxLength: number) => Type.String({ maxLength });

export const AdminStockLocationCreateBodySchema = Type.Object({
  name: RawText(400),
  note: Type.Optional(Type.Union([RawText(1000), Type.Null()])),
});

export const AdminStockLocationUpdateBodySchema = Type.Object({
  expectedVersion: Type.Integer({ minimum: 1 }),
  name: RawText(400),
  note: Type.Optional(Type.Union([RawText(1000), Type.Null()])),
});

export const AdminStockLocationStatusBodySchema = Type.Object({
  expectedVersion: Type.Integer({ minimum: 1 }),
});

export const AdminStockLocationWriteResultSchema = Type.Object({
  /** False when the location was already so (retiring a retired one): nothing was written. */
  changed: Type.Boolean(),
  location: AdminStockLocationSchema,
});

const LocationRefSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  name: Type.String(),
  status: StatusSchema,
  /** The name, marked "(retired)" when the location has been retired. */
  label: Type.String(),
});

export const AdminArtworkLocationMoveResultSchema = Type.Object({
  locationId: Type.String({ format: "uuid" }),
  /** Each artwork moved, with the location it left (null when none was recorded). */
  moved: Type.Array(
    Type.Object({
      registerId: Type.String({ format: "uuid" }),
      fromLocationId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    }),
  ),
  /** Already at the location: nothing recorded. */
  unchanged: Type.Array(Type.String({ format: "uuid" })),
  /** Not on the register. */
  notFound: Type.Array(Type.String({ format: "uuid" })),
});

export const AdminArtworkLocationParamsSchema = Type.Object({
  registerId: Type.String({ format: "uuid" }),
});

export const AdminArtworkLocationSchema = Type.Object({
  registerId: Type.String({ format: "uuid" }),
  /** The location, "(retired)" when so, or "Location not recorded". */
  label: Type.String(),
  current: Type.Union([
    Type.Object({
      location: LocationRefSchema,
      movedAt: Type.String({ format: "date-time" }),
      /** `staff:<user id>`. */
      movedBy: Type.String(),
    }),
    Type.Null(),
  ]),
  /** Newest first. */
  moves: Type.Array(
    Type.Object({
      id: Type.String({ format: "uuid" }),
      from: Type.Union([LocationRefSchema, Type.Null()]),
      to: LocationRefSchema,
      movedAt: Type.String({ format: "date-time" }),
      movedBy: Type.String(),
      note: Type.Union([Type.String(), Type.Null()]),
    }),
  ),
  /** True when older moves exist beyond `moves`. */
  moreMoves: Type.Boolean(),
});

export type AdminStockLocation = Static<typeof AdminStockLocationSchema>;
export type AdminStockLocationList = Static<typeof AdminStockLocationListSchema>;
export type AdminStockLocationListQuery = Static<typeof AdminStockLocationListQuerySchema>;
export type AdminStockLocationCreateBody = Static<typeof AdminStockLocationCreateBodySchema>;
export type AdminStockLocationUpdateBody = Static<typeof AdminStockLocationUpdateBodySchema>;
export type AdminStockLocationStatusBody = Static<typeof AdminStockLocationStatusBodySchema>;
export type AdminStockLocationWriteResult = Static<typeof AdminStockLocationWriteResultSchema>;
export type AdminArtworkLocationMoveResult = Static<typeof AdminArtworkLocationMoveResultSchema>;
export type AdminArtworkLocation = Static<typeof AdminArtworkLocationSchema>;
