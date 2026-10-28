import type { StaffAccessReviewRow } from "@/lib/data/http/staff-roles.server";
import type { UserStaffRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  accessReviewCounts,
  accessReviewCsvRows,
  filterAccessReview,
  parseAccessReviewFilters,
  sortAccessReview,
  toAccessReviewRows,
} from "./staff-access-review.vm";

const NOW = new Date("2026-10-28T12:00:00Z");

function role(name: UserStaffRole, endsAt: string | null = null) {
  return {
    id: `${name}-${endsAt ?? "open"}`,
    role: name,
    startsAt: "2026-01-05T09:00:00.000Z",
    endsAt,
    grantedAt: "2026-01-05T09:00:00.000Z",
    reason: null,
  };
}

const rows: StaffAccessReviewRow[] = [
  {
    userId: "ada",
    name: "Ada Lovelace",
    email: "ada@lax.test",
    suspended: false,
    lastSignInAt: "2026-10-27T08:00:00.000Z",
    roles: [role("cataloguer"), role("fulfilment", "2026-11-15T00:00:00.000Z")],
  },
  {
    userId: "bo",
    name: "Bo Carter",
    email: "bo@lax.test",
    suspended: false,
    lastSignInAt: null,
    roles: [role("finance", "2027-06-01T00:00:00.000Z")],
  },
  {
    userId: "cy",
    name: "Cy Dunn",
    email: "cy@lax.test",
    suspended: true,
    lastSignInAt: "2026-09-01T08:00:00.000Z",
    roles: [role("read_only")],
  },
];

describe("access review filters", () => {
  it("reads the view, role and search from the URL, ignoring unknown values", () => {
    expect(parseAccessReviewFilters({ view: "ending", role: "finance", q: " bo " })).toEqual({
      view: "ending",
      role: "finance",
      q: "bo",
    });
    expect(parseAccessReviewFilters({ view: "x", role: "operations" })).toEqual({
      view: "all",
      role: null,
      q: "",
    });
  });

  it("finds people holding a role, among all their roles", () => {
    const filters = { view: "all" as const, role: "fulfilment" as const, q: "" };
    expect(filterAccessReview(rows, filters, NOW).map((r) => r.userId)).toEqual(["ada"]);
  });

  it("finds roles ending within 30 days", () => {
    const filters = { view: "ending" as const, role: null, q: "" };
    expect(filterAccessReview(rows, filters, NOW).map((r) => r.userId)).toEqual(["ada"]);
  });

  it("searches names and emails", () => {
    const filters = { view: "all" as const, role: null, q: "CARTER" };
    expect(filterAccessReview(rows, filters, NOW).map((r) => r.userId)).toEqual(["bo"]);
  });

  it("counts each view under the role and search", () => {
    expect(accessReviewCounts(rows, { view: "ending", role: null, q: "" }, NOW)).toEqual({
      all: 3,
      ending: 1,
    });
    expect(accessReviewCounts(rows, { view: "all", role: "finance", q: "" }, NOW)).toEqual({
      all: 1,
      ending: 0,
    });
  });
});

describe("access review rows", () => {
  it("links records only for viewers who may open them", () => {
    expect(toAccessReviewRows(rows, NOW, null)[0]?.href).toBeNull();
    expect(toAccessReviewRows(rows, NOW, (id) => `/admin/staff/${id}`)[0]?.href).toBe(
      "/admin/staff/ada",
    );
  });

  it("sorts by soonest end, with open-ended people last either way", () => {
    const view = toAccessReviewRows(rows, NOW, null);
    expect(sortAccessReview(view, "ends_asc").map((r) => r.id)).toEqual(["ada", "bo", "cy"]);
    expect(sortAccessReview(view, "ends_desc").map((r) => r.id)).toEqual(["bo", "ada", "cy"]);
    expect(sortAccessReview(view, null).map((r) => r.id)).toEqual(["ada", "bo", "cy"]);
  });

  it("exports one CSV row per role held", () => {
    const csv = accessReviewCsvRows(rows);
    expect(csv).toHaveLength(4);
    expect(csv[1]).toMatchObject({
      name: "Ada Lovelace",
      role: "Fulfilment",
      lastDay: "14 Nov 2026",
    });
    expect(csv[3]).toMatchObject({ account: "Suspended", role: "Read-only", lastDay: "" });
  });
});
