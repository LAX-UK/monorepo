import { describe, expect, it } from "vitest";
import {
  STAFF_ROLE_OPTIONS,
  staffMemberName,
  staffRoleAllows,
  staffRoleChips,
  staffRoleNames,
  staffRolesAllow,
} from "./staff-directory.vm";

describe("a staff member", () => {
  it("is named by their profile name, then their email, never by an account id", () => {
    expect(staffMemberName({ displayName: "Ada Lovelace", email: "ada@lax.art" })).toBe(
      "Ada Lovelace",
    );
    expect(staffMemberName({ displayName: null, email: "ada@lax.art" })).toBe("ada@lax.art");
    expect(staffMemberName({ displayName: null, email: null })).toBe("Name not set yet");
  });
});

describe("LAX Admin roles", () => {
  it("each say in plain words what they allow, including Editor and Read-only", () => {
    for (const option of STAFF_ROLE_OPTIONS) {
      expect(option.label).not.toMatch(/_/);
      expect(option.description).toMatch(/\.$/);
    }
    expect(STAFF_ROLE_OPTIONS.map((o) => o.label)).toContain("Read-only");
    expect(staffRoleAllows("finance")).toBe(
      "Orders, refunds, payouts, edition prices and the audit log.",
    );
    expect(staffRoleAllows("wizard")).toBeNull();
  });

  it("say what several roles allow together, role by role", () => {
    expect(staffRolesAllow(["editor", "catalogue_editor"])).toBe(
      "Catalogue editor: Artworks, edition runs, artists and artist applications. Editor: Stories, exhibitions, pages and help, written and published.",
    );
    expect(staffRolesAllow(["finance"])).toBe(staffRoleAllows("finance"));
    expect(staffRolesAllow([])).toBeNull();
  });

  it("show each held role as a chip with its period, the last day being the day before the end", () => {
    const chips = staffRoleChips(
      {
        roles: [
          { role: "catalogue_editor", startsAt: "2026-10-03T09:00:00.000Z", endsAt: null },
          {
            role: "editor",
            startsAt: "2026-10-03T09:00:00.000Z",
            endsAt: "2026-12-01T00:00:00.000Z",
          },
        ],
      },
      new Date("2026-10-29T12:00:00Z"),
    );
    expect(chips.map((c) => [c.label, c.meta])).toEqual([
      ["Catalogue editor", "Since 3 Oct 2026"],
      ["Editor", "Since 3 Oct 2026 · Until 30 Nov 2026"],
    ]);
  });

  it("fall back to the role on the record when no assignment is listed", () => {
    expect(staffRoleNames({ role: "finance", roles: [] })).toEqual(["finance"]);
  });
});
