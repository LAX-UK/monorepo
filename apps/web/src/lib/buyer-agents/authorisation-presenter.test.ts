import type { BuyerAgentAuthorisationView } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  authorisationStatePresentation,
  formatPounds,
  liveAuthorisationsFor,
  revokeConsequence,
  summariseAuthorisation,
} from "./authorisation-presenter";

const base: BuyerAgentAuthorisationView = {
  id: "a1",
  userId: "agent-1",
  userName: "Adam Agent",
  userEmail: "adam@example.test",
  saleId: null,
  saleTitle: null,
  bidLimit: "10000.00",
  totalLimit: null,
  validFrom: "2026-10-27T12:00:00.000Z",
  validUntil: null,
  status: "active",
  scheduled: false,
  expired: false,
  createdByName: "Olivia Owner",
  createdAt: "2026-10-27T12:00:00.000Z",
  revokedAt: null,
  revokedReason: null,
};

describe("summariseAuthorisation", () => {
  it("reads an all-sales authorisation with a limit and no end", () => {
    expect(summariseAuthorisation(base)).toEqual({
      scope: "All sales",
      limit: "Up to £10,000",
      window: "No end date",
    });
  });

  it("reads one sale, no limit, a later start and an end in London days", () => {
    expect(
      summariseAuthorisation({
        ...base,
        saleId: "s1",
        saleTitle: "Modern British",
        bidLimit: null,
        scheduled: true,
        validFrom: "2026-11-01T00:00:00.000Z",
        validUntil: "2026-11-30T23:59:00.000Z",
      }),
    ).toEqual({
      scope: "Modern British",
      limit: "No limit",
      window: "From 1 Nov 2026 to 30 Nov 2026",
    });
  });
});

describe("authorisationStatePresentation", () => {
  it.each([
    [{}, "Can bid"],
    [{ scheduled: true }, "Starts later"],
    [{ expired: true }, "Ended"],
    [{ status: "revoked" as const }, "Revoked"],
  ])("labels %j as %s", (over, label) => {
    expect(authorisationStatePresentation({ ...base, ...over }).label).toBe(label);
  });
});

describe("liveAuthorisationsFor", () => {
  it("keeps one member's active ones, the sale-specific first", () => {
    const list = [
      base,
      { ...base, id: "a2", saleId: "s1", saleTitle: "Modern British" },
      { ...base, id: "a3", status: "revoked" as const },
      { ...base, id: "a4", expired: true },
      { ...base, id: "a5", userId: "someone-else" },
    ];
    expect(liveAuthorisationsFor(list, "agent-1").map((a) => a.id)).toEqual(["a2", "a1"]);
  });
});

describe("formatPounds and revokeConsequence", () => {
  it("formats whole and part pounds", () => {
    expect(formatPounds("2500.50")).toBe("£2,500.50");
    expect(formatPounds(10000)).toBe("£10,000");
  });

  it("says who loses what and that placed bids stand", () => {
    expect(revokeConsequence(base, "Northbank Gallery")).toBe(
      "Adam Agent will no longer be able to bid for Northbank Gallery in any sale. Bids already placed stand.",
    );
  });
});
