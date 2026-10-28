import { describe, expect, it } from "vitest";
import {
  formatLaxAdminRoleMigrationReport,
  planLaxAdminRoleMigrationReport,
} from "./lax-admin-role-migration-report.js";

const input = {
  environment: "TEST (lax-test-postgres)",
  generatedAt: new Date("2026-10-29T10:00:00Z"),
  active: [
    { subjectId: "s1", name: "Eleanor Pereira", email: "admin@lax.bid", role: "shop_admin" },
    { subjectId: "s2", name: "Cat Alogue", email: "cat@lax.bid", role: "catalogue_editor" },
    { subjectId: "s3", name: null, email: "erin@lax.bid", role: "finance" },
  ],
  disabled: 1,
  invitations: [{ email: "new@lax.bid", roles: ["catalogue_editor", "editor"] }],
};

describe("LAX Admin role migration report", () => {
  it("lists every person's role now and after, and confirms nobody loses access", () => {
    const report = formatLaxAdminRoleMigrationReport(input);
    expect(report).toContain("Environment: TEST (lax-test-postgres).");
    expect(report).toContain("- People who lose capabilities: 0");
    expect(report).toContain(
      "| Cat Alogue, cat@lax.bid | Catalogue editor | Catalogue editor, Editor | None | None |",
    );
    expect(report).toContain("| erin@lax.bid | Finance | Finance | None | None |");
    expect(report).toContain("| new@lax.bid | Catalogue editor, Editor |");
    expect(planLaxAdminRoleMigrationReport(input).peopleWithLosses).toBe(0);
  });

  it("flags a stored role the migration does not know", () => {
    const withUnknown = {
      ...input,
      active: [{ subjectId: "s9", name: "X", email: null, role: "gallery_manager" }],
    };
    expect(formatLaxAdminRoleMigrationReport(withUnknown)).toContain(
      "**Unknown role: the migration would stop**",
    );
    expect(planLaxAdminRoleMigrationReport(withUnknown).peopleWithLosses).toBe(1);
  });
});
