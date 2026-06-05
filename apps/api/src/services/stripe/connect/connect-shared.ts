import type { Database } from "@auction/db";
import { legalEntity } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import type { IStripeClientFactory } from "../../../lib/stripe-client.js";
import { StripeConnectNotConfiguredError } from "../../interfaces/stripe-connect.js";
import { throwConnectError } from "./connect-service-errors.js";

export async function loadConnectLegalEntity(db: Database, id: string) {
  const rows = await db.select().from(legalEntity).where(eq(legalEntity.id, id)).limit(1);
  const row = rows[0];
  if (!row) throwConnectError("legal_entity_not_found", 404);
  return row;
}

export function requireConnectStripe(stripeFactory: IStripeClientFactory): Stripe {
  const stripe = stripeFactory.get();
  if (!stripe) throw new StripeConnectNotConfiguredError();
  return stripe;
}

/** Cached Connect readiness when live Stripe sync is unavailable. */
export function connectReadyFromCachedEntity(entity: typeof legalEntity.$inferSelect): boolean {
  const due = entity.stripeConnectRequirementsCurrentlyDue ?? [];
  const disabledReason = entity.stripeConnectDisabledReason?.trim();
  return (
    Boolean(entity.stripeConnectAccountId) &&
    entity.stripeConnectPayoutsEnabled &&
    due.length === 0 &&
    !disabledReason
  );
}
