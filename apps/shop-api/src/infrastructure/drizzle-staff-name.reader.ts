import type { Database } from "@auction/db";
import { shopStaffMember, shopUserProfile } from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { StaffNameReader } from "../application/ports/staff-name.reader.js";

/** Staff names from the Shop profile, falling back to the email, like the enquiry inbox. */
export function createDrizzleStaffNameReader(db: Database): StaffNameReader {
  return {
    async namesFor(subjects) {
      const unique = [...new Set(subjects)];
      if (unique.length === 0) return new Map();
      const rows = await db
        .select({
          subject: shopStaffMember.identitySubjectId,
          name: shopUserProfile.name,
          email: shopUserProfile.email,
        })
        .from(shopStaffMember)
        .leftJoin(
          shopUserProfile,
          eq(shopUserProfile.identitySubjectId, shopStaffMember.identitySubjectId),
        )
        .where(inArray(shopStaffMember.identitySubjectId, unique));
      const names = new Map<string, string>();
      for (const row of rows) {
        const label = row.name?.trim() || row.email?.trim();
        if (label) names.set(row.subject, label);
      }
      return names;
    },
  };
}
