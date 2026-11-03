import { shopStaffMember } from "@auction/db/schema";
import { type SQL, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import {
  activeShopStaffRolesSql,
  currentShopStaffRolesSql,
  holdsAnyShopStaffRoleSql,
} from "./shop-staff-active-roles.sql.js";

const db = drizzle.mock();
const subject = shopStaffMember.identitySubjectId;
const QUALIFIED = '"shop_staff_member"."identity_subject_id"';

/** A single-table select prints columns bare, which would match the assignment to itself. */
function singleTableQuery(fragment: SQL): string {
  return db.select({ value: fragment }).from(shopStaffMember).where(eq(subject, "someone")).toSQL()
    .sql;
}

describe("staff role subqueries", () => {
  it("match the assignment to the member's subject, not to itself", () => {
    expect(singleTableQuery(activeShopStaffRolesSql(subject))).toContain(
      `a.identity_subject_id = ${QUALIFIED}`,
    );
    expect(singleTableQuery(currentShopStaffRolesSql(subject))).toContain(
      `a.identity_subject_id = ${QUALIFIED}`,
    );
    expect(singleTableQuery(holdsAnyShopStaffRoleSql(subject, ["finance"]))).toContain(
      `a.identity_subject_id = ${QUALIFIED}`,
    );
  });
});
