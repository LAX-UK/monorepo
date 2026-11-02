import { type Static, Type } from "@sinclair/typebox";

/** Who is on the release alert list, for LAX Admin. */
export const AdminReleaseAlertSummarySchema = Type.Object(
  {
    /** Confirmed subscribers: the people a published edition is emailed to. */
    confirmed: Type.Integer({ minimum: 0 }),
    /** Asked, but have not yet followed the link in the confirmation email. */
    awaitingConfirmation: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);
export type AdminReleaseAlertSummary = Static<typeof AdminReleaseAlertSummarySchema>;

/** Publishing one artwork can also email the release alert list. */
export const AdminArtworkPublishBodySchema = Type.Object(
  { sendReleaseAlert: Type.Optional(Type.Boolean()) },
  { additionalProperties: false },
);
export type AdminArtworkPublishBody = Static<typeof AdminArtworkPublishBodySchema>;
