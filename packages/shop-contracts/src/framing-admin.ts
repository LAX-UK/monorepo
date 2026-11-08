import { type Static, Type } from "@sinclair/typebox";

/**
 * LAX Admin's framing catalogue: ready-made framing options (frame, mount, glazing), each priced
 * per size band including VAT and with a lead time in working days. The value lists mirror the
 * ones in `@auction/shop-domain` (`framing.ts`); shop-api checks that the two agree.
 */

export const FRAMING_BAND_VALUES = ["up_to_40x50", "up_to_60x80", "up_to_80x100"] as const;
export const FRAMING_FRAME_VALUES = ["black_wood", "white_wood", "natural_oak"] as const;
export const FRAMING_MOUNT_VALUES = ["window_conservation", "float_conservation"] as const;
export const FRAMING_GLAZING_VALUES = ["uv_acrylic"] as const;
export const FRAMING_HANGING_VALUES = ["d_rings_cord"] as const;
export const FRAMING_STATUS_VALUES = ["draft", "active", "paused"] as const;

const literals = <const V extends readonly string[]>(values: V) =>
  Type.Unsafe<V[number]>(Type.Union(values.map((value) => Type.Literal(value))));

export const FramingBandSchema = literals(FRAMING_BAND_VALUES);
export type FramingBand = Static<typeof FramingBandSchema>;
export const FramingFrameSchema = literals(FRAMING_FRAME_VALUES);
export const FramingMountSchema = literals(FRAMING_MOUNT_VALUES);
export const FramingGlazingSchema = literals(FRAMING_GLAZING_VALUES);
export const FramingHangingSchema = literals(FRAMING_HANGING_VALUES);
export const FramingStatusSchema = literals(FRAMING_STATUS_VALUES);
export type FramingStatusValue = Static<typeof FramingStatusSchema>;

export const FRAMING_NAME_MAX = 80;

/** Pence including VAT for each band; every band has a price. */
export const FramingPricesSchema = Type.Object({
  up_to_40x50: Type.Integer({ minimum: 1, maximum: 1_000_000 }),
  up_to_60x80: Type.Integer({ minimum: 1, maximum: 1_000_000 }),
  up_to_80x100: Type.Integer({ minimum: 1, maximum: 1_000_000 }),
});
export type FramingPricesBody = Static<typeof FramingPricesSchema>;

export const FramingOptionSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  code: Type.String(),
  name: Type.String(),
  frame: FramingFrameSchema,
  mount: FramingMountSchema,
  glazing: FramingGlazingSchema,
  hanging: FramingHangingSchema,
  leadTimeMinDays: Type.Integer({ minimum: 1 }),
  leadTimeMaxDays: Type.Integer({ minimum: 1 }),
  pricesPence: FramingPricesSchema,
  status: FramingStatusSchema,
  /** The prices are the launch placeholders; the option cannot be offered until they change. */
  pricesPlaceholder: Type.Boolean(),
  /** Editions offering this option now. */
  editionCount: Type.Integer({ minimum: 0 }),
  /** The row's `updatedAt`, sent back as `expectedVersion` so a stale save is refused. */
  version: Type.String({ format: "date-time", maxLength: 40 }),
});
export type FramingOption = Static<typeof FramingOptionSchema>;

export const FramingOptionListSchema = Type.Object({
  items: Type.Array(FramingOptionSchema),
});
export type FramingOptionList = Static<typeof FramingOptionListSchema>;

/**
 * A whole number, or null while a field is still empty. Null comes first: the API coerces types,
 * and an integer listed first would turn a missing value into 0.
 */
const nullableInteger = Type.Union([Type.Null(), Type.Integer()]);

/** What staff enter for an option. Missing fields are reported by the rules, field by field. */
export const FramingOptionBodySchema = Type.Object({
  name: Type.String({ maxLength: 200 }),
  frame: FramingFrameSchema,
  mount: FramingMountSchema,
  glazing: FramingGlazingSchema,
  hanging: FramingHangingSchema,
  leadTimeMinDays: nullableInteger,
  leadTimeMaxDays: nullableInteger,
  pricesPence: Type.Object({
    up_to_40x50: nullableInteger,
    up_to_60x80: nullableInteger,
    up_to_80x100: nullableInteger,
  }),
  /** Offered: editions can pick the option. Off keeps a draft a draft and pauses the rest. */
  offered: Type.Boolean(),
});
export type FramingOptionBody = Static<typeof FramingOptionBodySchema>;

export const FramingOptionUpdateBodySchema = Type.Composite([
  FramingOptionBodySchema,
  Type.Object({ expectedVersion: Type.String({ format: "date-time", maxLength: 40 }) }),
]);
export type FramingOptionUpdateBody = Static<typeof FramingOptionUpdateBodySchema>;

/** 409 body: a stale save carries `currentVersion`, the version now held. */
export const FramingConflictBodySchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.Optional(Type.String()),
  currentVersion: Type.Optional(Type.String({ format: "date-time", maxLength: 40 })),
});

export const FramingOptionParamsSchema = Type.Object({ optionId: Type.String({ format: "uuid" }) });

/** Offer or pause an option without opening it. */
export const FramingOfferBodySchema = Type.Object({
  offered: Type.Boolean(),
  expectedVersion: Type.String({ format: "date-time", maxLength: 40 }),
});
export type FramingOfferBody = Static<typeof FramingOfferBodySchema>;

export const FRAMING_ISSUE_FIELDS = [
  "name",
  "leadTimeMinDays",
  "leadTimeMaxDays",
  "price:up_to_40x50",
  "price:up_to_60x80",
  "price:up_to_80x100",
  "offered",
] as const;

export const FRAMING_ISSUE_REASONS = [
  "name_required",
  "name_too_long",
  "lead_time_min_invalid",
  "lead_time_max_invalid",
  "lead_time_order",
  "price_missing",
  "price_invalid",
  "placeholder_prices",
] as const;

/** One thing wrong with a submitted option, against the field it belongs to. */
export const FramingIssueSchema = Type.Object({
  field: literals(FRAMING_ISSUE_FIELDS),
  reason: literals(FRAMING_ISSUE_REASONS),
});
export type FramingIssueBody = Static<typeof FramingIssueSchema>;

/** The 400 for an option that cannot be saved; `issues` names every field at fault. */
export const FramingRejectedBodySchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  requestId: Type.Optional(Type.String()),
  /** Absent when the request itself was malformed. */
  issues: Type.Optional(Type.Array(FramingIssueSchema)),
});
export type FramingRejectedBody = Static<typeof FramingRejectedBodySchema>;
