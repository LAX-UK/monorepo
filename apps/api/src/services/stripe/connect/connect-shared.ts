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
