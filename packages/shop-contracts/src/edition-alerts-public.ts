import "./contract-formats.js";
import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { ShopContractParseError } from "./parse-public.js";

/**
 * Edition alerts: "email me if this edition is back". A guest gives an email address; a
 * signed-in shopper's alert uses the account's address. Each alert email carries a token that
 * stops the alerts for its address without signing in.
 */

/** Unsubscribe tokens are 32 random bytes in base64url. */
export const EDITION_ALERT_TOKEN_PATTERN = "^[A-Za-z0-9_-]{43}$";

export const EditionAlertSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    artworkSlug: Type.String({ minLength: 1 }),
    artworkTitle: Type.String({ minLength: 1 }),
    artistName: Type.String({ minLength: 1 }),
    imageUrl: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export const EditionAlertListSchema = Type.Object(
  { items: Type.Array(EditionAlertSchema) },
  { additionalProperties: false },
);

export const EditionAlertIdParamsSchema = Type.Object(
  { alertId: Type.String({ format: "uuid" }) },
  { additionalProperties: false },
);

export const EditionAlertCancelResponseSchema = Type.Object(
  { status: Type.Union([Type.Literal("cancelled"), Type.Literal("already_stopped")]) },
  { additionalProperties: false },
);

export const EditionAlertTokenSchema = Type.String({ pattern: EDITION_ALERT_TOKEN_PATTERN });

export const EditionAlertUnsubscribeQuerySchema = Type.Object(
  { token: EditionAlertTokenSchema },
  { additionalProperties: false },
);

export const EditionAlertUnsubscribeBodySchema = Type.Object(
  { token: EditionAlertTokenSchema },
  { additionalProperties: false },
);

/** What the unsubscribe page shows before the person confirms. */
export const EditionAlertUnsubscribePreviewSchema = Type.Object(
  {
    /** The address with most of the local part hidden, e.g. `r•••@example.com`. */
    maskedEmail: Type.String({ minLength: 1 }),
    /** The edition the email was about. */
    artworkTitle: Type.String({ minLength: 1 }),
    /** Alerts still waiting for this address, which unsubscribing stops. */
    waitingCount: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const EditionAlertUnsubscribeResponseSchema = Type.Object(
  { stopped: Type.Integer({ minimum: 0 }) },
  { additionalProperties: false },
);

export type EditionAlert = Static<typeof EditionAlertSchema>;
export type EditionAlertList = Static<typeof EditionAlertListSchema>;
export type EditionAlertCancelResponse = Static<typeof EditionAlertCancelResponseSchema>;
export type EditionAlertUnsubscribePreview = Static<typeof EditionAlertUnsubscribePreviewSchema>;
export type EditionAlertUnsubscribeResponse = Static<typeof EditionAlertUnsubscribeResponseSchema>;

export function isEditionAlertToken(value: unknown): value is string {
  return typeof value === "string" && new RegExp(EDITION_ALERT_TOKEN_PATTERN).test(value);
}

export function parseEditionAlertList(value: unknown): EditionAlertList {
  if (!Value.Check(EditionAlertListSchema, value)) {
    throw new ShopContractParseError("Invalid edition alert list payload");
  }
  return value;
}

export function parseEditionAlertCancelResponse(value: unknown): EditionAlertCancelResponse {
  if (!Value.Check(EditionAlertCancelResponseSchema, value)) {
    throw new ShopContractParseError("Invalid edition alert cancel payload");
  }
  return value;
}

export function parseEditionAlertUnsubscribePreview(
  value: unknown,
): EditionAlertUnsubscribePreview {
  if (!Value.Check(EditionAlertUnsubscribePreviewSchema, value)) {
    throw new ShopContractParseError("Invalid edition alert unsubscribe preview payload");
  }
  return value;
}

export function parseEditionAlertUnsubscribeResponse(
  value: unknown,
): EditionAlertUnsubscribeResponse {
  if (!Value.Check(EditionAlertUnsubscribeResponseSchema, value)) {
    throw new ShopContractParseError("Invalid edition alert unsubscribe payload");
  }
  return value;
}
