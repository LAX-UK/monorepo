import { describe, expect, it } from "vitest";
import { planJoinHop, planRestoreHop, planSwitchHop, recordHop } from "./account-hops";

describe("planJoinHop", () => {
  it("opens a just-joined organisation's Home, remembered, without repeating the welcome", () => {
    expect(planJoinHop("org-1")).toEqual({
      redirect: "/home",
      switchTo: { accountId: "org-1", remember: true },
    });
  });
});

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

  it("offers the way back after a notification opened another account", () => {
    const base = { requestedId: "org-1", next, memberships, orgModuleEnabled: true };
    expect(planSwitchHop({ ...base, actingId: "me", notificationFrom: "me" }).switchTo).toEqual({
      accountId: "org-1",
      remember: true,
      notice: { kind: "opened_notification", accountId: "org-1", fromAccountId: "me" },
    });
    // Only the account this browser really used can be the way back.
    expect(
      planSwitchHop({ ...base, actingId: "me", notificationFrom: "org-7" }).switchTo?.notice,
    ).toEqual({ kind: "switched", accountId: "org-1" });
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
      }),
    ).toEqual({ redirect: "/home", switchTo: { accountId: "org-1", remember: false } });
  });

  it("explains a fallback after removal", () => {
    expect(
      planRestoreHop({
        next: "/home",
        restored: { accountId: "me", lostOrganisation: { displayName: "Northbank Gallery" } },
      }).switchTo?.notice,
    ).toEqual({ kind: "removed", organisationName: "Northbank Gallery" });
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

  it("shows the retry state, not 'not found', when the owner could not be looked up", () => {
    expect(recordHop({ kind: "unavailable" }, "me", next)).toBe(
      `/switch-account/unavailable?retry=${encodeURIComponent(next)}`,
    );
  });
});
