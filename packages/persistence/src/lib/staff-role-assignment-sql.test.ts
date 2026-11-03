import { bidUserProfile } from "@auction/db/schema";
import { type SQL, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import { holdsStaffRoleNow, staffRolesInForceFor } from "./staff-role-assignment-sql.js";

const db = drizzle.mock();

/** The profile's user_id shares its name with the assignment's, so a bare name would match itself. */
function selectListOf(fragment: SQL) {
  return db
    .select({ value: fragment })
    .from(bidUserProfile)
    .where(eq(bidUserProfile.userId, "any"))
    .toSQL().sql;
}

describe("staff role subqueries", () => {
  it("match the assignment to the person in the row, not to itself", () => {
    const person = '"user_id" = "bid_user_profile"."user_id"';
    expect(selectListOf(staffRolesInForceFor(bidUserProfile.userId))).toContain(person);
    expect(selectListOf(holdsStaffRoleNow(bidUserProfile.userId, "administrator"))).toContain(
      person,
    );
  });
});
