import type { EntityActor } from "@auction/domain";
import { describe, expect, it } from "vitest";
import {
  workspaceAccessDenied,
  workspacePageAt,
  workspacePageOpenedBy,
  workspacePageRefusal,
} from "./workspace-access";

const as = (role: EntityActor["role"]): EntityActor => ({ role });

describe("workspacePageAt", () => {
  it("names pages the way the menu and the Organisation tabs do", () => {
    expect(workspacePageAt("/organisation/payouts")?.label).toBe("Payouts");
    expect(workspacePageAt("/team?account=o1")?.label).toBe("Team");
    expect(workspacePageAt("/selling/payouts")?.label).toBe("Sold & payouts");
    expect(workspacePageAt("/selling/consignments")?.label).toBe("Consignments");
    expect(workspacePageAt("/collection")?.label).toBe("Works");
    expect(workspacePageAt("/bids")?.label).toBe("Bids");
  });

  it("names a record by what it is, never by its id", () => {
    expect(workspacePageAt("/selling/consignments/s-123")).toEqual({
      label: "this consignment",
      anyCapability: [],
      record: true,
    });
    expect(workspacePageAt("/purchases/checkout/lot-9")?.label).toBe("this purchase");
  });

  it("knows nothing of an address outside the workspace", () => {
    expect(workspacePageAt("/sales/modern-british")).toBeNull();
    expect(workspacePageAt("")).toBeNull();
  });
});

describe("workspacePageOpenedBy", () => {
  it("reads who can open a page from the capability table", () => {
    expect(workspacePageOpenedBy(["entity.connect.operate"])).toBe("Owners, admins and finance");
    expect(workspacePageOpenedBy(["entity.payouts.read"])).toBe("Owners, admins and finance");
    expect(workspacePageOpenedBy([])).toBeNull();
  });
});

describe("workspacePageRefusal", () => {
  it("tells a viewer who can open Payouts", () => {
    expect(workspacePageRefusal("/organisation/payouts", as("viewer"))).toEqual({
      label: "Payouts",
      openedBy: "Owners, admins and finance",
    });
    expect(workspacePageRefusal("/selling/payouts", as("consignor"))).toEqual({
      label: "Sold & payouts",
      openedBy: "Owners, admins and finance",
    });
  });

  it("opens a page any of whose capabilities the role holds", () => {
    // Works open with the organisation's holdings or its money.
    expect(workspacePageRefusal("/selling/works", as("finance"))).toBeNull();
    expect(workspacePageRefusal("/selling/works", as("viewer"))).toBeNull();
    expect(workspacePageRefusal("/selling/consignments", as("buyer_agent"))).toEqual({
      label: "Consignments",
      openedBy: expect.stringMatching(/^Owners, admins/),
    });
  });

  it("never refuses a personal account, or a page every member opens", () => {
    expect(workspacePageRefusal("/selling/payouts", null)).toBeNull();
    expect(workspacePageRefusal("/notifications", as("viewer"))).toBeNull();
  });
});

describe("workspaceAccessDenied", () => {
  it("names who can open the page when the role is the reason", () => {
    expect(workspaceAccessDenied("/organisation/payouts", as("viewer"))).toEqual({
      page: "Payouts",
      openedBy: "Owners, admins and finance",
    });
  });

  it("names nobody when the page belongs to an account the person is not using", () => {
    // The owner can open Payouts in their own organisation; the link was for another one.
    expect(workspaceAccessDenied("/organisation/payouts?account=o2", as("owner"))).toEqual({
      page: "Payouts",
      openedBy: null,
    });
    expect(workspaceAccessDenied("/selling/consignments/s1", as("viewer"))).toEqual({
      page: "this consignment",
      openedBy: null,
    });
    expect(workspaceAccessDenied("/selling/consignments/s1", null)).toEqual({
      page: "this consignment",
      openedBy: null,
    });
  });

  it("falls back to no name for an address it does not know", () => {
    expect(workspaceAccessDenied("/somewhere", as("viewer"))).toEqual({
      page: null,
      openedBy: null,
    });
  });
});
