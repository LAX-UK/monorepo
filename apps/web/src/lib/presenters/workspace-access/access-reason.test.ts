import { describe, expect, it } from "vitest";
import { askAnOwnerLine, workspaceAccessReason } from "./access-reason";

describe("workspaceAccessReason", () => {
  it("names the page, the organisation and who can open it, then what the role can do", () => {
    expect(
      workspaceAccessReason({
        page: "Sold & payouts",
        organisationName: "Northbank Gallery",
        openedBy: "Owners, admins and finance",
        role: "consignor",
      }),
    ).toBe(
      "Sold & payouts for Northbank Gallery is open to owners, admins and finance. As a consignor, you can follow your own works in Consignments.",
    );
  });

  it("covers the drawn cases: finance on Bids, a buyer agent on Team, a viewer on Purchases", () => {
    const line = (page: string, openedBy: string, role: "finance" | "buyer_agent" | "viewer") =>
      workspaceAccessReason({ page, organisationName: "Northbank Gallery", openedBy, role });
    expect(line("Bids", "Owners, admins and buyer agents", "finance")).toMatch(
      /^Bids for Northbank Gallery is open to owners, admins and buyer agents\./,
    );
    expect(line("Team", "Owners and admins", "buyer_agent")).toMatch(/change to your limits\.$/);
    expect(line("Purchases", "Owners, admins, finance and buyer agents", "viewer")).toMatch(
      /^Purchases for Northbank Gallery is open to owners, admins, finance and buyer agents\./,
    );
  });

  it("says nothing of its own when nobody is named", () => {
    expect(
      workspaceAccessReason({
        page: "this consignment",
        organisationName: "Northbank Gallery",
        openedBy: null,
        role: "viewer",
      }),
    ).toBeNull();
  });
});

describe("askAnOwnerLine", () => {
  it("names the first owner, or nobody", () => {
    expect(askAnOwnerLine(["Maya Okafor", "Jonah Reed"])).toBe(
      "Need access? Ask an owner: Maya Okafor",
    );
    expect(askAnOwnerLine([])).toBeNull();
  });
});
