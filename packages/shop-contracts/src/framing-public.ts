import { type Static, Type } from "@sinclair/typebox";
import {
  FramingFrameSchema,
  FramingGlazingSchema,
  FramingHangingSchema,
  FramingMountSchema,
} from "./framing-admin.js";

/**
 * What a buyer can choose for framing on an edition, and the framing on a basket line. Prices are
 * worked out by shop-api from the catalogue and the edition's own prices; a buyer only ever names
 * an option id. Only offered options with every price the framer's are listed.
 */

export const PublicFramingOptionSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    name: Type.String(),
    frame: FramingFrameSchema,
    mount: FramingMountSchema,
    glazing: FramingGlazingSchema,
    hanging: FramingHangingSchema,
    /** Pence including VAT for this edition's size. */
    pricePence: Type.Integer({ minimum: 1 }),
    leadTimeMinDays: Type.Integer({ minimum: 1 }),
    leadTimeMaxDays: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);
export type PublicFramingOption = Static<typeof PublicFramingOptionSchema>;

export const PublicEditionFramingSchema = Type.Object(
  {
    /**
     * none: nothing to show; choose: pick unframed or an option (`required` when unframed is not
     * on offer); framed_by_artist: the print comes framed, described in `description`;
     * unavailable: sold framed only and no option is on offer right now.
     */
    kind: Type.Union([
      Type.Literal("none"),
      Type.Literal("choose"),
      Type.Literal("framed_by_artist"),
      Type.Literal("unavailable"),
    ]),
    required: Type.Boolean(),
    description: Type.Union([Type.String(), Type.Null()]),
    options: Type.Array(PublicFramingOptionSchema),
  },
  { additionalProperties: false },
);
export type PublicEditionFraming = Static<typeof PublicEditionFramingSchema>;

/** The framing on a basket line, priced by shop-api. */
export const BasketLineFramingSchema = Type.Object(
  {
    optionId: Type.String({ format: "uuid" }),
    name: Type.String(),
    frame: FramingFrameSchema,
    mount: FramingMountSchema,
    glazing: FramingGlazingSchema,
    hanging: FramingHangingSchema,
    /** For one print; the line's framing total is this times its quantity. */
    pricePence: Type.Integer({ minimum: 0 }),
    leadTimeMinDays: Type.Integer({ minimum: 1 }),
    leadTimeMaxDays: Type.Integer({ minimum: 1 }),
    /** False when the option is paused or no longer offered on this edition. */
    available: Type.Boolean(),
  },
  { additionalProperties: false },
);
export type BasketLineFraming = Static<typeof BasketLineFramingSchema>;

export const BasketLineFramingBodySchema = Type.Object(
  { framingOptionId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]) },
  { additionalProperties: false },
);
export type BasketLineFramingBody = Static<typeof BasketLineFramingBodySchema>;
