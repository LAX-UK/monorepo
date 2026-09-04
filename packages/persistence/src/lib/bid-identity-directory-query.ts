import { bidIdentityDirectory } from "@auction/db/schema";
import { type SQL, isNull, sql } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";

export function normalizeIdentityEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizedIdentityEmailEquals(column: AnyColumn, email: string): SQL {
  return sql`lower(trim(${column})) = ${normalizeIdentityEmail(email)}`;
}

/** Excludes retained merge aliases from user discovery and list surfaces. */
export function activeIdentitySubject(): SQL {
  return isNull(bidIdentityDirectory.mergedIntoSubjectId);
}
