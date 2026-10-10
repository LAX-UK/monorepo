import { shopUserProfile } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { and, isNull, sql } from "drizzle-orm";
import { ShopApiError, notFound } from "../errors/shop-api-error.js";
import type { shopPhaseDbSession } from "./drizzle-shop-transaction-effects.js";

export async function resolveActiveProfileByEmail(
  tx: ReturnType<typeof shopPhaseDbSession>,
  email: string,
): Promise<{ identitySubjectId: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const profiles = await tx
    .select({ identitySubjectId: shopUserProfile.identitySubjectId })
    .from(shopUserProfile)
    .where(
      and(
        sql`lower(${shopUserProfile.email}) = ${normalizedEmail}`,
        isNull(shopUserProfile.disabledAt),
        isNull(shopUserProfile.mergedIntoSubjectId),
      ),
    )
    .limit(2);
  if (profiles.length > 1) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.CONFLICT,
      "Email matches more than one active shop login",
      409,
    );
  }
  const profile = profiles[0];
  if (!profile) {
    throw notFound("No LAX login uses that email yet. Invite them from LAX admin first.");
  }
  return profile;
}
