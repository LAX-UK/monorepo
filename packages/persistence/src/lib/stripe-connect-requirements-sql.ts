import { legalEntity } from "@auction/db/schema";
import { sql } from "drizzle-orm";

/** Count of distinct outstanding Stripe requirement keys (currently due ∪ error requirements). */
export const stripeConnectOutstandingCountExpr = sql<number>`(
  SELECT count(*)::int FROM (
    SELECT jsonb_array_elements_text(${legalEntity.stripeConnectRequirementsCurrentlyDue}) AS key
    UNION
    SELECT trim(e->>'requirement')
    FROM jsonb_array_elements(${legalEntity.stripeConnectRequirementsErrors}) AS e
    WHERE coalesce(trim(e->>'requirement'), '') <> ''
  ) merged
)`;

export const stripeConnectHasOutstandingExpr = sql`(
  SELECT count(*)::int FROM (
    SELECT jsonb_array_elements_text(${legalEntity.stripeConnectRequirementsCurrentlyDue}) AS key
    UNION
    SELECT trim(e->>'requirement')
    FROM jsonb_array_elements(${legalEntity.stripeConnectRequirementsErrors}) AS e
    WHERE coalesce(trim(e->>'requirement'), '') <> ''
  ) merged
) > 0`;
