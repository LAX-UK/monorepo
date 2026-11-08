import "./contract-formats.js";
import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { ShopContractParseError } from "./parse-public.js";

/**
 * A signed-in person's own email alerts from LAX Shop and lax.art, for the one Email alerts page
 * in LAX Account. Only topics a person switches themselves appear here: "Notify me" requests are
 * made per edition and counted, not switched.
 */

export const ACCOUNT_EMAIL_ALERT_TOPICS = ["shop.releases", "art.followed_artists"] as const;

export const AccountEmailAlertTopicSchema = Type.Union(
  ACCOUNT_EMAIL_ALERT_TOPICS.map((topic) => Type.Literal(topic)),
);

export const AccountEmailAlertTopicParamsSchema = Type.Object(
  { topic: AccountEmailAlertTopicSchema },
  { additionalProperties: false },
);

export const AccountEmailAlertSwitchBodySchema = Type.Object(
  { on: Type.Boolean() },
  { additionalProperties: false },
);

export const AccountEmailAlertsSchema = Type.Object(
  {
    /** Every switchable topic, in page order; a topic the person never used is off. */
    topics: Type.Array(
      Type.Object(
        {
          topic: AccountEmailAlertTopicSchema,
          emailOn: Type.Boolean(),
          /** Present (true) only when the person stopped all alerts for this topic's product. */
          stopped: Type.Optional(Type.Boolean()),
        },
        { additionalProperties: false },
      ),
    ),
    /** Editions the person pressed "Notify me" on and is still waiting for. */
    waitingEditions: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

/** Why a switch could not be turned on. */
export const AccountEmailAlertRefusalSchema = Type.Object(
  {
    ok: Type.Literal(false),
    reason: Type.Union([
      Type.Literal("unverified"),
      Type.Literal("blocked"),
      Type.Literal("no_account"),
    ]),
  },
  { additionalProperties: false },
);

export const AccountEmailAlertSavedSchema = Type.Object(
  { ok: Type.Literal(true) },
  { additionalProperties: false },
);

export type AccountEmailAlertTopic = Static<typeof AccountEmailAlertTopicSchema>;
export type AccountEmailAlerts = Static<typeof AccountEmailAlertsSchema>;
export type AccountEmailAlertRefusal = Static<typeof AccountEmailAlertRefusalSchema>;

export function parseAccountEmailAlerts(value: unknown): AccountEmailAlerts {
  if (!Value.Check(AccountEmailAlertsSchema, value)) {
    throw new ShopContractParseError("Invalid account email alerts payload");
  }
  return value;
}
