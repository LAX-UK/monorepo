import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  adminUserListSelect,
  buildAdminUserListOrderBy,
  buildAdminUserListWhere,
  mapAdminUserListRow,
} from "./admin-user-list-sql.js";

describe("admin-user-list-sql", () => {
  const dialect = new PgDialect();

  it("applies active-subject and profile-less default-aware filters", () => {
    const where = buildAdminUserListWhere({
      limit: 25,
      offset: 0,
      role: "client",
      emailStatus: "ok",
      kycStatus: "unverified",
    });
    expect(where).toBeDefined();
    if (!where) throw new Error("Expected canonical admin-user predicate");
    const query = dialect.sqlToQuery(where);

    expect(query.sql).toContain('"bid_identity_directory"."merged_into_subject_id" is null');
    expect(query.sql).toContain('"bid_user_profile"."user_id" is null');
    expect(query.sql).toContain('"bid_user_profile"."role" = $1');
    expect(query.sql).toContain('"bid_user_profile"."email_status" = $2');
    expect(query.sql).toContain('"bid_user_profile"."kyc_status" = $3');
    expect(query.params).toEqual(["client", "ok", "unverified"]);
  });

  it("builds all material list filters from the canonical tables", () => {
    const where = buildAdminUserListWhere({
      q: "person",
      limit: 25,
      offset: 0,
      staffRole: "support_concierge",
      accountStatus: "suspended",
      emailVerified: true,
      kycStatuses: ["approved", "declined"],
      persona: "organisation",
      deletionRequestedOnly: true,
      hasMobile: true,
      createdFrom: new Date("2025-01-01T00:00:00.000Z"),
      createdToExclusive: new Date("2026-01-01T00:00:00.000Z"),
      kycVerifiedFrom: new Date("2025-02-01T00:00:00.000Z"),
      kycVerifiedToExclusive: new Date("2025-03-01T00:00:00.000Z"),
    });
    expect(where).toBeDefined();
    if (!where) throw new Error("Expected filtered admin-user predicate");
    const query = dialect.sqlToQuery(where);

    expect(query.sql).toContain('"bid_identity_directory"."email" ilike');
    expect(query.sql).toContain('"bid_identity_directory"."name" ilike');
    expect(query.sql).toContain('"bid_user_profile"."mobile" ilike');
    expect(query.sql).toContain('"bid_user_profile"."staff_role" =');
    expect(query.sql).toContain('"bid_user_profile"."suspended_at" is not null');
    expect(query.sql).toContain('"bid_identity_directory"."email_verified" =');
    expect(query.sql).toContain('"bid_user_profile"."kyc_status" in');
    expect(query.sql).toContain('"bid_user_profile"."signup_persona" =');
    expect(query.sql).toContain('"bid_identity_directory"."deletion_requested_at" is not null');
    expect(query.sql).toContain('trim("bid_user_profile"."mobile") <>');
    expect(query.sql).toContain('"bid_identity_directory"."identity_created_at" >=');
    expect(query.sql).toContain('"bid_identity_directory"."identity_created_at" <');
    expect(query.sql).toContain('"bid_user_profile"."kyc_verified_at" >=');
    expect(query.sql).toContain('"bid_user_profile"."kyc_verified_at" <');
  });

  it("uses Identity creation and the latest materialized change timestamps", () => {
    const createdAt = adminUserListSelect.createdAt;
    const updatedAt = dialect.sqlToQuery(adminUserListSelect.updatedAt);

    expect(createdAt.name).toBe("identity_created_at");
    expect(updatedAt.sql).toContain(
      'greatest("bid_user_profile"."updated_at", "bid_identity_directory"."replicated_at")',
    );
  });

  it("maps profile-less projected rows with stable defaults", () => {
    const createdAt = new Date("2025-01-01T00:00:00.000Z");
    const updatedAt = new Date("2025-02-01T00:00:00.000Z");

    expect(
      mapAdminUserListRow({
        id: "identity-subject",
        email: "person@example.com",
        name: "Person",
        firstName: null,
        lastName: null,
        role: "client",
        staffRole: null,
        createdAt,
        updatedAt,
        suspendedAt: null,
        image: null,
        mobile: null,
        mobileCountry: null,
        emailVerified: false,
        emailStatus: "ok",
        signupPersona: null,
        kycStatus: "unverified",
        kycVerifiedAt: null,
        kycRetryCount: 0,
        deletionRequestedAt: null,
      }),
    ).toMatchObject({
      role: "client",
      emailStatus: "ok",
      kycStatus: "unverified",
      kycRetryCount: 0,
      twoFactorEnabled: false,
      createdAt,
      updatedAt,
    });
  });

  it.each([
    [undefined, '"identity_created_at" desc'],
    ["created_desc", '"identity_created_at" desc'],
    ["created_asc", '"identity_created_at" asc'],
    ["name_asc", '"name" asc'],
    ["name_desc", '"name" desc'],
    ["kyc_status", '"kyc_status" asc'],
  ] as const)("builds canonical %s sort", (sort, expectedSql) => {
    const query = dialect.sqlToQuery(buildAdminUserListOrderBy(sort));
    expect(query.sql).toContain(expectedSql);
  });

  it("supports email and KYC filters together", () => {
    const clause = buildAdminUserListWhere({
      limit: 25,
      offset: 0,
      emailVerified: true,
      kycStatus: "approved",
      accountStatus: "active",
    });
    expect(clause).toBeDefined();
  });
});
