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

/**
 * Where one release's alert stands, in the order a send moves through. `not_sent_yet` is a digest
 * still unsent more than a day after it was made: someone should look.
 */
export const ADMIN_RELEASE_ALERT_SEND_STATUSES = [
  "not_announced",
  "queued",
  "sending",
  "sent",
  "not_sent_yet",
] as const;
export type AdminReleaseAlertSendStatus = (typeof ADMIN_RELEASE_ALERT_SEND_STATUSES)[number];

const Count = Type.Integer({ minimum: 0 });

/**
 * One published edition release and what its alert did. Counts only: the log is about sends, not
 * people, so no subscriber name or address is ever part of it.
 */
export const AdminReleaseAlertSendSchema = Type.Object(
  {
    artworkId: Type.String({ format: "uuid" }),
    title: Type.String(),
    /** An absolute thumbnail address, when the work has one. */
    imageUrl: Type.Union([Type.String(), Type.Null()]),
    /** When the edition was first published and the alert recorded. */
    publishedAt: Type.String({ format: "date-time" }),
    /** The staff member who published it, from the artwork's audit row; null when none is kept. */
    publishedByName: Type.Union([Type.String(), Type.Null()]),
    /** False when the publisher unticked "Tell subscribers". */
    toldSubscribers: Type.Boolean(),
    status: Type.Union(ADMIN_RELEASE_ALERT_SEND_STATUSES.map((s) => Type.Literal(s))),
    /** People the release matched. */
    matched: Count,
    /** Matches in a digest that went out. */
    emailed: Count,
    /** Matches not yet in a sent digest. */
    waiting: Count,
    /** Matches dropped before sending. */
    notSent: Count,
    /** Why matches were dropped, most first. */
    notSentReasons: Type.Array(
      Type.Object({ reason: Type.String(), count: Count }, { additionalProperties: false }),
    ),
  },
  { additionalProperties: false },
);
export type AdminReleaseAlertSend = Static<typeof AdminReleaseAlertSendSchema>;

export const ADMIN_RELEASE_ALERT_SENDS_MAX_LIMIT = 50;

export const AdminReleaseAlertSendsQuerySchema = Type.Object(
  {
    cursor: Type.Optional(Type.String({ maxLength: 512 })),
    limit: Type.Optional(
      Type.Integer({ minimum: 1, maximum: ADMIN_RELEASE_ALERT_SENDS_MAX_LIMIT }),
    ),
  },
  { additionalProperties: false },
);
export type AdminReleaseAlertSendsQuery = Static<typeof AdminReleaseAlertSendsQuerySchema>;

/** Newest release first; `nextCursor` is null on the last page. */
export const AdminReleaseAlertSendListSchema = Type.Object(
  {
    items: Type.Array(AdminReleaseAlertSendSchema),
    nextCursor: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);
export type AdminReleaseAlertSendList = Static<typeof AdminReleaseAlertSendListSchema>;
