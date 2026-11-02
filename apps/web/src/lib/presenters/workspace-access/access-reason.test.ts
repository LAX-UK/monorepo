import { describe, expect, it } from "vitest";
import { askAnOwnerLine, workspaceAccessReason } from "./access-reason";

describe("workspaceAccessReason", () => {
  it("names the page, the organisation and who can open it, then what the role can do", () => {
    expect(
      workspaceAccessReason({
        page: "Sold & payouts",
        openedBy: "Owners, admins and finance",
        role: "consignor",
      }),
    ).toBe(
      "Sold & payouts is for owners, admins and finance. As a consignor, you can follow your own works in Consignments.",
    );
  });

  it("covers the drawn cases: finance on Bids, a buyer agent on Members, a viewer on Purchases", () => {
    const line = (page: string, openedBy: string, role: "finance" | "buyer_agent" | "viewer") =>
      workspaceAccessReason({ page, openedBy, role });
    expect(line("Bids", "Owners, admins and buyer agents", "finance")).toMatch(
      /^Bids is for owners, admins and buyer agents\./,
    );
    expect(line("Members", "Owners and admins", "buyer_agent")).toBe(
      "Members is for owners and admins.",
    );
    expect(line("Purchases", "Owners, admins, finance and buyer agents", "viewer")).toBe(
      "Purchases is for owners, admins, finance and buyer agents. As a viewer, you can see what the organisation owns in Collection.",
    );
  });

  it("says nothing of its own when nobody is named", () => {
    expect(
      workspaceAccessReason({
        page: "this consignment",
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
