import { type Static, Type } from "@sinclair/typebox";

/**
 * Where LAX Shop delivers: four regions with lead times in working days, an optional fixed price
 * per region (empty means it is quoted), and the countries it does not deliver to. The region,
 * field and reason lists mirror `@auction/shop-domain` delivery-regions; shop-api checks they agree.
 * The public read is what the storefront builds checkout and the delivery page from; the admin
 * read adds the names staff see; saving is staff only.
 */

export const DELIVERY_REGION_ID_VALUES = ["uk", "eu", "north_america", "asia_pacific"] as const;

export const DeliveryRegionIdSchema = Type.Union(
  DELIVERY_REGION_ID_VALUES.map((id) => Type.Literal(id)),
);
export type DeliveryRegionIdValue = Static<typeof DeliveryRegionIdSchema>;

export const LeadTimeSchema = Type.Object({
  minDays: Type.Integer({ minimum: 1 }),
  maxDays: Type.Integer({ minimum: 1 }),
});
export type LeadTime = Static<typeof LeadTimeSchema>;

export const DeliveryRegionSchema = Type.Object({
  id: DeliveryRegionIdSchema,
  name: Type.String(),
  standard: LeadTimeSchema,
  specialist: LeadTimeSchema,
  /** Pence, tax-inclusive; `null` means delivery to the region is quoted. */
  fixedPricePence: Type.Union([Type.Null(), Type.Integer({ minimum: 1 })]),
  /** ISO 3166-1 alpha-2 codes of the countries in the region. */
  countries: Type.Array(Type.String({ minLength: 2, maxLength: 2 })),
});
export type DeliveryRegionView = Static<typeof DeliveryRegionSchema>;

export const DeliveryCountrySchema = Type.Object({
  code: Type.String({ minLength: 2, maxLength: 2 }),
  name: Type.String(),
});
export type DeliveryCountry = Static<typeof DeliveryCountrySchema>;

/** What the storefront reads: the regions, and the countries it does not deliver to. */
export const PublicDeliveryRegionsSchema = Type.Object({
  regions: Type.Array(DeliveryRegionSchema),
  notDeliveredTo: Type.Array(DeliveryCountrySchema),
});
export type PublicDeliveryRegions = Static<typeof PublicDeliveryRegionsSchema>;

/** What LAX Admin shows: the same, and the choices for the restricted list. */
export const AdminDeliveryRegionsSchema = Type.Object({
  regions: Type.Array(DeliveryRegionSchema),
  notDeliveredTo: Type.Array(DeliveryCountrySchema),
  /** Every country the restricted list can name, A to Z. */
  countryChoices: Type.Array(DeliveryCountrySchema),
});
export type AdminDeliveryRegions = Static<typeof AdminDeliveryRegionsSchema>;

export const AdminDeliveryRegionParamsSchema = Type.Object({ id: DeliveryRegionIdSchema });

export const AdminDeliveryRegionUpdateBodySchema = Type.Object({
  standardMinDays: Type.Integer(),
  standardMaxDays: Type.Integer(),
  specialistMinDays: Type.Integer(),
  specialistMaxDays: Type.Integer(),
  /** `null` first: the request parser coerces `null` to `0` for a union that tries an integer first. */
  fixedPricePence: Type.Union([Type.Null(), Type.Integer()]),
});
export type AdminDeliveryRegionUpdateBody = Static<typeof AdminDeliveryRegionUpdateBodySchema>;

export const AdminDeliveryRestrictedCountriesBodySchema = Type.Object({
  countries: Type.Array(Type.String({ minLength: 2, maxLength: 2 }), { maxItems: 250 }),
});
export type AdminDeliveryRestrictedCountriesBody = Static<
  typeof AdminDeliveryRestrictedCountriesBodySchema
>;

/** Why a region's save was refused, field by field. */
export const AdminDeliveryRegionIssueSchema = Type.Object({
  field: Type.Union([
    Type.Literal("standardMinDays"),
    Type.Literal("standardMaxDays"),
    Type.Literal("specialistMinDays"),
    Type.Literal("specialistMaxDays"),
    Type.Literal("fixedPricePence"),
  ]),
  reason: Type.String(),
});
export type AdminDeliveryRegionIssue = Static<typeof AdminDeliveryRegionIssueSchema>;

/** Why the restricted list was refused, country by country. */
export const AdminDeliveryRestrictedCountryIssueSchema = Type.Object({
  code: Type.String(),
  reason: Type.String(),
});
export type AdminDeliveryRestrictedCountryIssue = Static<
  typeof AdminDeliveryRestrictedCountryIssueSchema
>;

export const AdminDeliveryRegionRejectedBodySchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.Optional(Type.String()),
  issues: Type.Optional(
    Type.Array(
      Type.Union([AdminDeliveryRegionIssueSchema, AdminDeliveryRestrictedCountryIssueSchema]),
    ),
  ),
});
