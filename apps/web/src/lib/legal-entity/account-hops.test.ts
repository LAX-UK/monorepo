import { describe, expect, it } from "vitest";
import { planRestoreHop, planSwitchHop, recordHop } from "./account-hops";

const memberships = [
  { id: "me", kind: "individual" as const },
  { id: "org-1", kind: "organisation" as const },
];
const next = "/selling/consignments/s1";

describe("planSwitchHop", () => {
  it("switches to an organisation the person belongs to, with the notice", () => {
    expect(
      planSwitchHop({
        requestedId: "org-1",
        next,
        actingId: "me",
        memberships,
        orgModuleEnabled: true,
      }),
    ).toEqual({
      redirect: next,
      switchTo: {
        accountId: "org-1",
        remember: true,
        notice: { kind: "switched", accountId: "org-1" },
      },
    });
  });

  it("goes straight through when the link is already in the right account", () => {
    expect(
      planSwitchHop({
        requestedId: "org-1",
        next,
        actingId: "org-1",
        memberships,
        orgModuleEnabled: true,
      }),
    ).toEqual({ redirect: next });
  });

  it("shows the no-access page to a non-member", () => {
    expect(
      planSwitchHop({
        requestedId: "org-9",
        next,
        actingId: "me",
        memberships,
        orgModuleEnabled: true,
      }),
    ).toEqual({ redirect: `/no-access?next=${encodeURIComponent(next)}` });
  });

  it("shows the no-access page while organisations are switched off", () => {
    expect(
      planSwitchHop({
        requestedId: "org-1",
        next,
        actingId: "me",
        memberships,
        orgModuleEnabled: false,
      }).redirect,
    ).toMatch(/^\/no-access/);
  });
});

describe("planRestoreHop", () => {
  it("opens the restored account quietly", () => {
    expect(
      planRestoreHop({
        next: "/home",
        restored: { accountId: "org-1", lostOrganisation: null },
        personalId: "me",
      }),
    ).toEqual({ redirect: "/home", switchTo: { accountId: "org-1", remember: false } });
  });

  it("explains a fallback after removal", () => {
    expect(
      planRestoreHop({
        next: "/home",
        restored: { accountId: "me", lostOrganisation: { displayName: "Northbank Gallery" } },
        personalId: "me",
      }).switchTo?.notice,
    ).toEqual({ kind: "removed", organisationName: "Northbank Gallery" });
  });

  it("falls back to the personal account when the API cannot answer", () => {
    expect(planRestoreHop({ next: "/bids", restored: null, personalId: "me" })).toEqual({
      redirect: "/bids",
      switchTo: { accountId: "me", remember: false },
    });
  });
});

describe("recordHop", () => {
  it("switches to the organisation that owns a consignment", () => {
    expect(recordHop({ kind: "ok", legalEntityId: "org-1" }, "me", next)).toBe(
      `/switch-account?to=org-1&next=${encodeURIComponent(next)}`,
    );
  });

  it("renders the page when it is already in the owning account", () => {
    expect(recordHop({ kind: "ok", legalEntityId: "org-1" }, "org-1", next)).toBeNull();
  });

  it("shows the no-access page for a record of an organisation the person is not in", () => {
    expect(recordHop({ kind: "no_access" }, "me", next)).toBe(
      `/no-access?next=${encodeURIComponent(next)}`,
    );
  });

  it("leaves a missing record to the page's not-found", () => {
    expect(recordHop({ kind: "not_found" }, "me", next)).toBeNull();
  });
});
