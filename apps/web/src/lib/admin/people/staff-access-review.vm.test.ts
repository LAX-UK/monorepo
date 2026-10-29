import type { StaffAccessReviewRow } from "@/lib/data/http/staff-roles.server";
import type { LaxShopStaffRole, UserStaffRole } from "@auction/types";
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

function laxRole(name: LaxShopStaffRole, endsAt: string | null = null) {
  return { ...role("finance", endsAt), id: `lax-${name}`, role: name, pending: null };
}

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
    laxAdminRoles: [laxRole("editor")],
  },
  {
    userId: "bo",
    name: "Bo Carter",
    email: "bo@lax.test",
    suspended: false,
    lastSignInAt: null,
    roles: [role("finance", "2027-06-01T00:00:00.000Z")],
    laxAdminRoles: [],
  },
  {
    userId: "cy",
    name: "Cy Dunn",
    email: "cy@lax.test",
    suspended: true,
    lastSignInAt: "2026-09-01T08:00:00.000Z",
    roles: [role("read_only")],
    laxAdminRoles: [],
  },
  {
    userId: "dee",
    name: "Dee Ellis",
    email: "dee@lax.test",
    suspended: false,
    lastSignInAt: null,
    roles: [],
    laxAdminRoles: [laxRole("catalogue_editor", "2026-11-20T00:00:00.000Z"), laxRole("editor")],
  },
];

describe("access review filters", () => {
  it("reads the view, role and search from the URL, ignoring unknown values", () => {
    expect(parseAccessReviewFilters({ view: "ending", role: "finance", q: " bo " })).toEqual({
      view: "ending",
      product: null,
      role: "finance",
      q: "bo",
    });
    expect(parseAccessReviewFilters({ view: "x", role: "operations" })).toEqual({
      view: "all",
      product: null,
      role: null,
      q: "",
    });
    // A role is read as the chosen admin's: Editor is a LAX Admin role only.
    expect(parseAccessReviewFilters({ product: "shop", role: "editor" })).toMatchObject({
      product: "shop",
      role: "editor",
    });
    expect(parseAccessReviewFilters({ product: "bid", role: "editor" }).role).toBeNull();
  });

  it("finds people holding a role, among all their roles", () => {
    const filters = { view: "all" as const, product: null, role: "fulfilment", q: "" };
    expect(filterAccessReview(rows, filters, NOW).map((r) => r.userId)).toEqual(["ada"]);
  });

  it("finds roles ending within 30 days, on either admin", () => {
    const filters = { view: "ending" as const, product: null, role: null, q: "" };
    expect(filterAccessReview(rows, filters, NOW).map((r) => r.userId)).toEqual(["ada", "dee"]);
  });

  it("narrows to one admin's staff and roles", () => {
    const lax = { view: "all" as const, product: "shop" as const, role: null, q: "" };
    expect(filterAccessReview(rows, lax, NOW).map((r) => r.userId)).toEqual(["ada", "dee"]);
    const editors = { ...lax, role: "catalogue_editor" };
    expect(filterAccessReview(rows, editors, NOW).map((r) => r.userId)).toEqual(["dee"]);
    const bid = { ...lax, product: "bid" as const };
    expect(filterAccessReview(rows, bid, NOW).map((r) => r.userId)).toEqual(["ada", "bo", "cy"]);
    expect(toAccessReviewRows(rows, NOW, null, "shop")[0]?.roleGroups.map((g) => g.label)).toEqual([
      "LAX Admin",
    ]);
  });

  it("searches names and emails", () => {
    const filters = { view: "all" as const, product: null, role: null, q: "CARTER" };
    expect(filterAccessReview(rows, filters, NOW).map((r) => r.userId)).toEqual(["bo"]);
  });

  it("counts each view under the role and search", () => {
    expect(
      accessReviewCounts(rows, { view: "ending", product: null, role: null, q: "" }, NOW),
    ).toEqual({
      all: 4,
      ending: 2,
    });
    expect(
      accessReviewCounts(rows, { view: "all", product: null, role: "finance", q: "" }, NOW),
    ).toEqual({
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
    expect(sortAccessReview(view, "ends_asc").map((r) => r.id)).toEqual(["ada", "dee", "bo", "cy"]);
    expect(sortAccessReview(view, "ends_desc").map((r) => r.id)).toEqual([
      "bo",
      "dee",
      "ada",
      "cy",
    ]);
    expect(sortAccessReview(view, null).map((r) => r.id)).toEqual(["ada", "bo", "cy", "dee"]);
  });

  it("exports one CSV row per role held on each admin", () => {
    const csv = accessReviewCsvRows(rows);
    expect(csv).toHaveLength(7);
    expect(csv[1]).toMatchObject({
      name: "Ada Lovelace",
      admin: "Bid admin",
      role: "Fulfilment",
      lastDay: "14 Nov 2026",
    });
    expect(csv[2]).toMatchObject({ name: "Ada Lovelace", admin: "LAX Admin", role: "Editor" });
    expect(csv[4]).toMatchObject({ account: "Suspended", role: "Read-only", lastDay: "" });
    expect(accessReviewCsvRows(rows, "shop").map((r) => r.role)).toEqual([
      "Editor",
      "",
      "",
      "Catalogue editor",
      "Editor",
    ]);
  });
});
