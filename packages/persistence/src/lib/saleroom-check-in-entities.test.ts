import { describe, expect, it } from "vitest";
import { groupEligibleCheckInEntities } from "./saleroom-check-in-entities.js";

describe("groupEligibleCheckInEntities", () => {
  it("keeps the memberships that may bid for their legal entity", () => {
    const map = groupEligibleCheckInEntities([
      {
        userId: "u1",
        legalEntityId: "le-ind",
        role: "owner",
        displayName: "Private Collector",
        kind: "individual",
        regStatus: null,
        regPaddle: null,
        regBidLimit: null,
        regCheckedInAt: null,
      },
      {
        userId: "u1",
        legalEntityId: "le-org",
        role: "buyer_agent",
        displayName: "Agency Ltd",
        kind: "organisation",
        regStatus: "approved",
        regPaddle: 142,
        regBidLimit: null,
        regCheckedInAt: new Date("2026-06-18T18:00:00.000Z"),
      },
      {
        userId: "u1",
        legalEntityId: "le-viewer",
        role: "viewer",
        displayName: "Viewer Org",
        kind: "organisation",
        regStatus: null,
        regPaddle: null,
        regBidLimit: null,
        regCheckedInAt: null,
      },
    ]);

    const entities = map.get("u1") ?? [];
    expect(entities).toHaveLength(2);
    expect(entities.map((entity) => entity.id).sort()).toEqual(["le-ind", "le-org"]);
    expect(
      entities.find((entity) => entity.id === "le-org")?.existingRegistration?.paddleNumber,
    ).toBe(142);
  });
});
