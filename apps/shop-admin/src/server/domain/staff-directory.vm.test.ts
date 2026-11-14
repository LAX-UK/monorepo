import { pinClock } from "@/test/pin-clock";
import { describe, expect, it } from "vitest";
import {
  STAFF_ROLE_OPTIONS,
  bidStaffMemberHref,
  staffMemberName,
  staffRoleAllows,
  staffRoleChips,
  staffRoleNames,
  staffRolePeriods,
  staffRolesAllow,
} from "./staff-directory.vm";

pinClock();

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

  it("note in the row only the roles that end or have not started", () => {
    const now = new Date("2026-10-29T12:00:00Z");
    expect(
      staffRolePeriods(
        {
          roles: [
            { role: "catalogue_editor", startsAt: "2026-10-03T09:00:00.000Z", endsAt: null },
            {
              role: "editor",
              startsAt: "2026-10-03T09:00:00.000Z",
              endsAt: "2026-12-01T00:00:00.000Z",
            },
            { role: "finance", startsAt: "2026-11-03T09:00:00.000Z", endsAt: null },
          ],
        },
        now,
      ),
    ).toBe("Editor until Mon 30 Nov · Finance from Tue 3 Nov");
    expect(
      staffRolePeriods(
        { roles: [{ role: "operations", startsAt: "2026-01-10T09:00:00.000Z", endsAt: null }] },
        now,
      ),
    ).toBeNull();
  });

  it("link to the person's page in Bid admin, where roles are managed", () => {
    expect(bidStaffMemberHref("https://bid.test/admin/staff", { identitySubjectId: "a b" })).toBe(
      "https://bid.test/admin/staff/a%20b",
    );
    expect(bidStaffMemberHref(undefined, { identitySubjectId: "a" })).toBeNull();
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
      ["Catalogue editor", "Since Sat 3 Oct"],
      ["Editor", "Since Sat 3 Oct · Until Mon 30 Nov"],
    ]);
  });

  it("fall back to the role on the record when no assignment is listed", () => {
    expect(staffRoleNames({ role: "finance", roles: [] })).toEqual(["finance"]);
  });
});
