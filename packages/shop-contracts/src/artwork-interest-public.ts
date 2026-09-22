import { type Static, Type } from "@sinclair/typebox";

export const ArtworkInterestIntentSchema = Type.Union([
  Type.Literal("notify_me"),
  Type.Literal("enquiry"),
]);

export const RegisterArtworkInterestRequestSchema = Type.Object(
  {
    intent: Type.Optional(ArtworkInterestIntentSchema),
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
  },
  { additionalProperties: false },
);

export type ArtworkInterestIntent = Static<typeof ArtworkInterestIntentSchema>;
export type ArtworkInterestStatus = Static<typeof ArtworkInterestStatusSchema>;
export type RegisterArtworkInterestRequest = Static<typeof RegisterArtworkInterestRequestSchema>;
export type RegisterArtworkInterestResponse = Static<typeof RegisterArtworkInterestResponseSchema>;
