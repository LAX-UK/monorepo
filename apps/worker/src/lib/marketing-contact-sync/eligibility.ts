import type { Database } from "@auction/db";
import { emailSuppression } from "@auction/db/schema";
import { emailHash } from "@auction/email";
import { eq } from "drizzle-orm";

/** Roles excluded from the marketing ESP audience (internal accounts). */
export const MARKETING_CONTACT_EXCLUDED_ROLES = ["staff"] as const;

export type MarketingContactUserRow = {
  email: string;
  emailVerified: boolean;
  role: string;
  emailStatus: string;
  suspendedAt: Date | null;
  deletionRequestedAt: Date | null;
};

export type MarketingContactSkipReason =
  | "deletion_requested"
  | "excluded_role"
  | "email_status"
  | "suspended"
  | "suppressed";

/** Returns a skip reason when the user must not be upserted to the marketing ESP. */
export function marketingContactSkipReason(
  row: MarketingContactUserRow,
  suppressed: boolean,
): MarketingContactSkipReason | null {
  if (row.deletionRequestedAt) return "deletion_requested";
  if ((MARKETING_CONTACT_EXCLUDED_ROLES as readonly string[]).includes(row.role)) {
    return "excluded_role";
  }
  if (row.emailStatus !== "ok") return "email_status";
  if (row.suspendedAt != null) return "suspended";
  if (suppressed) return "suppressed";
  return null;
}

export async function isEmailSuppressed(db: Database, email: string): Promise<boolean> {
  const [hit] = await db
    .select({ emailHash: emailSuppression.emailHash })
    .from(emailSuppression)
    .where(eq(emailSuppression.emailHash, emailHash(email)))
    .limit(1);
  return Boolean(hit);
}
