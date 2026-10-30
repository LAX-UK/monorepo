import { connectRequirementsAttentionCount } from "@auction/connect";
import type { ILegalEntityConnectReader } from "@auction/persistence/interfaces";
import type { LegalEntityConnectRow } from "@auction/persistence/lib";
import type Stripe from "stripe";
import type { IStripeClientFactory } from "../../../lib/stripe-client.js";
import { StripeConnectNotConfiguredError } from "../../interfaces/stripe-connect.js";
import { throwConnectError } from "./connect-service-errors.js";

export async function loadConnectLegalEntity(reader: ILegalEntityConnectReader, id: string) {
  const row = await reader.findLegalEntityRowById(id);
  if (!row) throwConnectError("legal_entity_not_found", 404);
  return row;
}

export function requireConnectStripe(stripeFactory: IStripeClientFactory): Stripe {
  const stripe = stripeFactory.get();
  if (!stripe) throw new StripeConnectNotConfiguredError();
  return stripe;
}

/** Cached Connect readiness when live Stripe sync is unavailable. */
export function connectReadyFromCachedEntity(entity: LegalEntityConnectRow): boolean {
  const disabledReason = entity.stripeConnectDisabledReason?.trim();
  return (
    Boolean(entity.stripeConnectAccountId) &&
    entity.stripeConnectPayoutsEnabled &&
    connectRequirementsAttentionCount(
      entity.stripeConnectRequirementsCurrentlyDue,
      entity.stripeConnectRequirementsErrors,
    ) === 0 &&
    !disabledReason
  );
}

/**
 * How Stripe answered a read of the stored Connect account, when it did not return it:
 * - `missing` (`resource_missing`): the account definitively does not exist (a seeded or
 *   deleted id). Payouts are not set up, and setting up may replace the id.
 * - `unreachable` (`account_invalid`): this key cannot see the account. That is ambiguous:
 *   revoked access, a wrong API key, or no such account. The id is kept and never replaced.
 * - null: any other error, which is a real failure and is not hidden.
 */
export type ConnectAccountReadFailure = "missing" | "unreachable";

export function classifyConnectAccountReadError(err: unknown): ConnectAccountReadFailure | null {
  if (!err || typeof err !== "object") return null;
  const { type, code } = err as { type?: unknown; code?: unknown };
  if (type !== "StripePermissionError" && type !== "StripeInvalidRequestError") return null;
  if (code === "resource_missing") return "missing";
  if (code === "account_invalid") return "unreachable";
  return null;
}
