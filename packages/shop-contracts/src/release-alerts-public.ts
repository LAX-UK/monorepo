import "./contract-formats.js";
import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { ENQUIRY_CONTACT_EMAIL_MAX_LENGTH } from "./enquiry-contact.js";
import { ShopContractParseError } from "./parse-public.js";

/**
 * Release alerts: one email for each new edition LAX Shop releases. A visitor gives an address
 * and confirms it from an email; a signed-in shopper is subscribed with the account's address.
 * Every email carries a link that stops the alerts without signing in.
 */

/** Confirmation and unsubscribe tokens are 32 random bytes in base64url. */
export const RELEASE_ALERT_TOKEN_PATTERN = "^[A-Za-z0-9_-]{43}$";

export const ReleaseAlertTokenSchema = Type.String({ pattern: RELEASE_ALERT_TOKEN_PATTERN });

export const ReleaseAlertSubscribeBodySchema = Type.Object(
  {
    /** Required without an account; a signed-in shopper's account address is used instead. */
    email: Type.Optional(
      Type.String({ format: "email", maxLength: ENQUIRY_CONTACT_EMAIL_MAX_LENGTH }),
    ),
    /** The page the form was on, recorded with the person's consent. */
    source: Type.Optional(Type.String({ minLength: 1, maxLength: 40, pattern: "^[a-z0-9_]+$" })),
    /** Honeypot: people never see it, so bots that fill it are dropped. */
    website: Type.Optional(Type.String({ maxLength: 500 })),
  },
  { additionalProperties: false },
);

/**
 * What asking for alerts tells the browser. A visitor always hears `check_email`, whether or not
 * the address was already known, so the form cannot be used to find out who is subscribed.
 */
export const ReleaseAlertSubscribeResponseSchema = Type.Object(
  { status: Type.Union([Type.Literal("check_email"), Type.Literal("subscribed")]) },
  { additionalProperties: false },
);

export const ReleaseAlertStatusSchema = Type.Object(
  { subscribed: Type.Boolean() },
  { additionalProperties: false },
);

export const ReleaseAlertConfirmBodySchema = Type.Object(
  { token: ReleaseAlertTokenSchema },
  { additionalProperties: false },
);

export const ReleaseAlertConfirmResponseSchema = Type.Object(
  { outcome: Type.Union([Type.Literal("confirmed"), Type.Literal("expired")]) },
  { additionalProperties: false },
);

export const ReleaseAlertUnsubscribeQuerySchema = Type.Object(
  { token: ReleaseAlertTokenSchema },
  { additionalProperties: false },
);

export const ReleaseAlertUnsubscribeBodySchema = ReleaseAlertConfirmBodySchema;

/** What the stop page shows before the person confirms. */
export const ReleaseAlertUnsubscribePreviewSchema = Type.Object(
  {
    /** The address with most of the local part hidden, e.g. `r•••@example.com`. */
    maskedEmail: Type.String({ minLength: 1 }),
    /** False once the alerts have already been stopped. */
    active: Type.Boolean(),
  },
  { additionalProperties: false },
);

export type ReleaseAlertSubscribeBody = Static<typeof ReleaseAlertSubscribeBodySchema>;
export type ReleaseAlertSubscribeResponse = Static<typeof ReleaseAlertSubscribeResponseSchema>;
export type ReleaseAlertStatus = Static<typeof ReleaseAlertStatusSchema>;
export type ReleaseAlertConfirmResponse = Static<typeof ReleaseAlertConfirmResponseSchema>;
export type ReleaseAlertUnsubscribePreview = Static<typeof ReleaseAlertUnsubscribePreviewSchema>;

export function isReleaseAlertToken(value: unknown): value is string {
  return typeof value === "string" && new RegExp(RELEASE_ALERT_TOKEN_PATTERN).test(value);
}

function parser<S extends Parameters<typeof Value.Check>[0]>(schema: S, label: string) {
  return (value: unknown): Static<S> => {
    if (!Value.Check(schema, value)) {
      throw new ShopContractParseError(`Invalid release alert ${label} payload`);
    }
    return value as Static<S>;
  };
}

export const parseReleaseAlertSubscribeResponse = parser(
  ReleaseAlertSubscribeResponseSchema,
  "subscribe",
);
export const parseReleaseAlertStatus = parser(ReleaseAlertStatusSchema, "status");
export const parseReleaseAlertConfirmResponse = parser(
  ReleaseAlertConfirmResponseSchema,
  "confirm",
);
export const parseReleaseAlertUnsubscribePreview = parser(
  ReleaseAlertUnsubscribePreviewSchema,
  "unsubscribe preview",
);
