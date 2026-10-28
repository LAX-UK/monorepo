import type { StaffRoleAssignmentView } from "@/lib/data/http/staff-roles.server";
import {
  FORBIDDEN_STAFF_ROLE_COMBINATIONS,
  type LaxShopStaffRole,
  type UserStaffRole,
  forbiddenStaffRoleCombination,
  userStaffRoles,
} from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  BID_ROLE_PRODUCT as BID,
  LAX_ADMIN_ROLE_PRODUCT as LAX,
  type StaffRoleHeld,
  addStaffRoleIssue,
  addableStaffRoleOptions,
  removeStaffRoleBlock,
  staffRoleChip,
  staffRoleEndsAtFromLastDay,
} from "./staff-roles.vm";

const NOW = new Date("2026-10-28T12:00:00Z");

function held(role: UserStaffRole, overrides: Partial<StaffRoleAssignmentView> = {}) {
  return {
    id: `asg-${role}`,
    role,
    startsAt: "2026-10-03T09:00:00.000Z",
    endsAt: null,
    grantedAt: "2026-10-03T09:00:00.000Z",
    reason: null,
    ...overrides,
  } satisfies StaffRoleAssignmentView;
}

describe("staffRoleChip", () => {
  it("says since when an open-ended role is held", () => {
    expect(staffRoleChip(held("finance"), NOW, BID)).toMatchObject({
      label: "Finance",
      meta: "Since 3 Oct 2026",
      endingSoon: false,
    });
  });

  it("names the last day, and counts down once it is within 30 days", () => {
    const later = staffRoleChip(
      held("fulfilment", { endsAt: "2027-03-01T00:00:00.000Z" }),
      NOW,
      BID,
    );
    expect(later.meta).toBe("Since 3 Oct 2026 · Until 28 Feb 2027");
    const soon = staffRoleChip(
      held("fulfilment", { endsAt: "2026-11-10T00:00:00.000Z" }),
      NOW,
      BID,
    );
    expect(soon).toMatchObject({ endingSoon: true });
    expect(soon.meta).toBe("Since 3 Oct 2026 · Until 9 Nov 2026 · 13 days left");
  });

  it("says when a role starts later", () => {
    expect(
      staffRoleChip(held("finance", { startsAt: "2026-11-02T09:00:00.000Z" }), NOW, BID).meta,
    ).toBe("Starts 2 Nov 2026");
  });
});

describe("staffRoleEndsAtFromLastDay", () => {
  it("ends a role when the day after its last day starts in London", () => {
    expect(staffRoleEndsAtFromLastDay("2026-11-30")).toBe("2026-12-01T00:00:00.000Z");
    expect(staffRoleEndsAtFromLastDay("2026-07-31")).toBe("2026-07-31T23:00:00.000Z");
    expect(staffRoleEndsAtFromLastDay(null)).toBeNull();
  });
});

describe("addableStaffRoleOptions", () => {
  it("offers every role not already held, each with what the job does", () => {
    const options = addableStaffRoleOptions([held("finance")], BID);
    expect(options.map((o) => o.value)).not.toContain("finance");
    expect(options).toHaveLength(userStaffRoles.length - 1);
    expect(options.every((o) => o.description.length > 0)).toBe(true);
  });
});

describe("addStaffRoleIssue", () => {
  it("explains every forbidden combination before saving", () => {
    for (const rule of FORBIDDEN_STAFF_ROLE_COMBINATIONS) {
      const partners =
        rule.with === "any" ? userStaffRoles.filter((r) => r !== rule.role) : rule.with;
      for (const partner of partners) {
        const issue = addStaffRoleIssue([held(rule.role)], partner, null, NOW, BID);
        expect(issue?.field).toBe("role");
        // Where two rules apply (administrator and read-only), the first one found explains it.
        const why = forbiddenStaffRoleCombination(rule.role, partner)?.why ?? "";
        expect(issue?.message).toContain(why);
        const reverse = addStaffRoleIssue([held(partner)], rule.role, null, NOW, BID);
        expect(reverse?.field).toBe("role");
        expect(reverse?.message).toContain(why);
      }
    }
  });

  it("accepts a role that can be held alongside the others", () => {
    expect(addStaffRoleIssue([held("cataloguer")], "fulfilment", null, NOW, BID)).toBeNull();
  });

  it("puts a past end date on the last-day field", () => {
    expect(addStaffRoleIssue([], "fulfilment", "2026-10-01T00:00:00.000Z", NOW, BID)).toEqual({
      field: "lastDay",
      message: "Choose an end date after today.",
    });
  });
});

describe("removeStaffRoleBlock", () => {
  it("keeps the last administrator's role and says why", () => {
    expect(removeStaffRoleBlock([held("administrator")], "administrator", 0, NOW, BID)).toBe(
      "The only administrator can't lose the role. Give someone else the administrator role first.",
    );
    expect(removeStaffRoleBlock([held("administrator")], "administrator", 1, NOW, BID)).toBeNull();
    expect(removeStaffRoleBlock([held("finance")], "finance", 0, NOW, BID)).toBeNull();
  });
});

describe("LAX Admin roles", () => {
  function laxHeld(
    role: LaxShopStaffRole,
    pending: "assign" | "remove" | null = null,
  ): StaffRoleHeld<LaxShopStaffRole> {
    return {
      id: `lax-${role}`,
      role,
      startsAt: "2026-10-03T09:00:00.000Z",
      endsAt: null,
      grantedAt: "2026-10-03T09:00:00.000Z",
      reason: null,
      pending,
    };
  }

  it("names LAX Admin roles and offers the ones not held", () => {
    expect(staffRoleChip(laxHeld("shop_admin"), NOW, LAX).label).toBe("Administrator");
    const options = addableStaffRoleOptions([laxHeld("catalogue_editor")], LAX).map((o) => o.value);
    expect(options).toContain("editor");
    expect(options).not.toContain("catalogue_editor");
  });

  it("explains each LAX Admin forbidden pair before saving", () => {
    expect(addStaffRoleIssue([laxHeld("broker")], "finance", null, NOW, LAX)).toEqual({
      field: "role",
      message:
        "Finance can't be combined with Broker. Moving money and selling to clients are kept with different people.",
    });
    expect(addStaffRoleIssue([laxHeld("account_manager")], "finance", null, NOW, LAX)?.field).toBe(
      "role",
    );
    expect(addStaffRoleIssue([laxHeld("editor")], "read_only", null, NOW, LAX)).not.toBeNull();
    expect(addStaffRoleIssue([laxHeld("catalogue_editor")], "editor", null, NOW, LAX)).toBeNull();
  });

  it("shows a change LAX Admin has not applied yet, and blocks another one", () => {
    const chip = staffRoleChip(laxHeld("editor", "assign"), NOW, LAX);
    expect(chip).toMatchObject({ meta: "Waiting for LAX Admin to add it", pending: "assign" });
    expect(removeStaffRoleBlock([laxHeld("editor", "assign")], "editor", 1, NOW, LAX)).toBe(
      "LAX Admin has not applied the last change to this role yet.",
    );
    // A role on its way out no longer counts against a new one.
    expect(addStaffRoleIssue([laxHeld("broker", "remove")], "finance", null, NOW, LAX)).toBeNull();
  });

  it("keeps the last LAX Admin Administrator", () => {
    expect(removeStaffRoleBlock([laxHeld("shop_admin")], "shop_admin", 0, NOW, LAX)).toBe(
      "The only administrator can't lose the role. Give someone else the administrator role first.",
    );
  });
});
