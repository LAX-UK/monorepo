import { organisationStateAllows } from "@auction/domain";
import { legalEntityStatuses } from "@auction/types";
import { describe, expect, it } from "vitest";
import { splitBuyerMembershipsByState } from "./buyer-entity-state";

const membership = (status: (typeof legalEntityStatuses)[number]) => ({
  id: `le-${status}`,
  displayName: `Gallery ${status}`,
  role: "buyer_agent" as const,
  status,
});

describe("splitBuyerMembershipsByState", () => {
  it("offers exactly the accounts the server lets anyone bid and register for", () => {
    const { open, paused } = splitBuyerMembershipsByState(legalEntityStatuses.map(membership));
    for (const status of legalEntityStatuses) {
      const isOpen = open.some((m) => m.status === status);
      expect(isOpen).toBe(organisationStateAllows(status, "register"));
      expect(isOpen).toBe(organisationStateAllows(status, "bid"));
      expect(isOpen || paused.some((m) => m.status === status)).toBe(true);
    }
  });

  it("never offers a restricted organisation, and keeps why", () => {
    const { open, paused } = splitBuyerMembershipsByState([
      membership("restricted"),
      membership("approved"),
    ]);
    expect(open.map((m) => m.status)).toEqual(["approved"]);
    expect(paused).toEqual([{ ...membership("restricted"), reason: "restricted" }]);
  });

  it("keeps an organisation setting up payouts open, as the table allows", () => {
    expect(splitBuyerMembershipsByState([membership("connect_pending")]).open).toHaveLength(1);
  });

  it("names the documents wait for an organisation under review", () => {
    expect(splitBuyerMembershipsByState([membership("under_review")]).paused[0]?.reason).toBe(
      "documents_under_review",
    );
  });
});
