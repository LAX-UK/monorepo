import { type Static, Type } from "@sinclair/typebox";
import { EnquiryContactProperties } from "./enquiry-contact.js";

export const ArtworkInterestIntentSchema = Type.Union([
  Type.Literal("notify_me"),
  Type.Literal("enquiry"),
]);

export const RegisterArtworkInterestRequestSchema = Type.Object(
  {
    intent: Type.Optional(ArtworkInterestIntentSchema),
    message: Type.Optional(Type.String({ minLength: 1, maxLength: 2000 })),
    /** Same shape as checkout `deliveryPhone`. */
    contactPhone: Type.Optional(
      Type.String({ minLength: 8, maxLength: 20, pattern: "^\\+?[0-9][0-9 ()-]{6,19}$" }),
    ),
    ...EnquiryContactProperties,
  },
  { additionalProperties: false },
);

export const ArtworkInterestStatusSchema = Type.Object(
  {
    subscribed: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const RegisterArtworkInterestResponseSchema = Type.Object(
  {
    status: Type.Union([Type.Literal("registered"), Type.Literal("already_subscribed")]),
    /** An enquiry's reference ("E-2041"), quoted in the sender's copy and by staff. */
    reference: Type.Optional(Type.String({ pattern: "^E-[0-9]+$" })),
  },
  { additionalProperties: false },
);

export type ArtworkInterestIntent = Static<typeof ArtworkInterestIntentSchema>;
export type ArtworkInterestStatus = Static<typeof ArtworkInterestStatusSchema>;
export type RegisterArtworkInterestRequest = Static<typeof RegisterArtworkInterestRequestSchema>;
export type RegisterArtworkInterestResponse = Static<typeof RegisterArtworkInterestResponseSchema>;
