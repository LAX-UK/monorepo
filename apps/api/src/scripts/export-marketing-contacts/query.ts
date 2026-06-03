import type { Database } from "@auction/db";
import { emailSuppression, user } from "@auction/db/schema";
import { emailHash } from "@auction/email";
import { and, eq, isNull, notInArray } from "drizzle-orm";

/**
 * Eligibility rules must stay aligned with
 * `apps/worker/src/lib/marketing-contact-sync/eligibility.ts` (worker cannot import apps/api).
 */
export const MARKETING_CONTACT_EXCLUDED_ROLES = ["staff"] as const;

export type MarketingContactRow = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  country: string | null;
  role: string;
  kycStatus: string;
  emailVerified: boolean;
  signupSource: string | null;
  createdAt: Date;
};

/**
 * Load registered users eligible for the marketing audience, applying the same
 * eligibility rules as the live `marketing-contact-sync` job.
 */
export async function loadEligibleMarketingContacts(db: Database): Promise<MarketingContactRow[]> {
  const rows = await db
    .select({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      country: user.mobileCountry,
      role: user.role,
      kycStatus: user.kycStatus,
      emailVerified: user.emailVerified,
      signupSource: user.signupPersona,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(
      and(
        eq(user.emailStatus, "ok"),
        notInArray(user.role, [...MARKETING_CONTACT_EXCLUDED_ROLES]),
        isNull(user.suspendedAt),
        isNull(user.deletionRequestedAt),
      ),
    );

  const suppressedHashes = new Set(
    (await db.select({ h: emailSuppression.emailHash }).from(emailSuppression)).map((r) => r.h),
  );

  return rows.filter((row) => !suppressedHashes.has(emailHash(row.email)));
}

const CSV_HEADER =
  "EMAIL,FIRSTNAME,LASTNAME,COUNTRY,ROLE,KYC_STATUS,EMAIL_VERIFIED,SIGNUP_SOURCE,CREATED_AT";

export function contactsToCsv(rows: MarketingContactRow[]): string {
  const lines = [CSV_HEADER];
  for (const row of rows) {
    lines.push(
      [
        escapeCsv(row.email),
        escapeCsv(row.firstName ?? ""),
        escapeCsv(row.lastName ?? ""),
        escapeCsv(row.country ?? ""),
        escapeCsv(row.role),
        escapeCsv(row.kycStatus),
        row.emailVerified ? "true" : "false",
        escapeCsv(row.signupSource ?? ""),
        row.createdAt.toISOString(),
      ].join(","),
    );
  }
  return lines.join("\n");
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}
