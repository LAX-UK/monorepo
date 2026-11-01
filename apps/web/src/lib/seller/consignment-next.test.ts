import { agreementAcceptanceHold } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { consignmentNextStep } from "./consignment-next";

describe("consignmentNextStep for an agreement", () => {
  const owner = { canAccept: true, organisation: "Northbank Gallery", chooseBy: null };

  it("asks someone who may accept to accept it", () => {
    expect(consignmentNextStep("agreement", { ...owner, acceptHold: null })).toBe(
      "Accept the agreement below and we catalogue the work for its sale.",
    );
  });

  it("tells a paused organisation, even its owner, that accepting is paused, not to accept", () => {
    const acceptHold = agreementAcceptanceHold({ kind: "organisation", status: "restricted" });
    const next = consignmentNextStep("agreement", { ...owner, acceptHold });
    expect(next).toBe(
      "Selling is paused for Northbank Gallery, so the agreement can't be accepted for now. Contact us to find out why and when it resumes.",
    );
    expect(next).not.toMatch(/^Accept/);
    // A member who could not accept anyway is not sent to an owner who cannot either.
    expect(consignmentNextStep("agreement", { ...owner, canAccept: false, acceptHold })).toBe(next);
  });

  it("says what unblocks an organisation LAX is still checking", () => {
    const acceptHold = agreementAcceptanceHold({ kind: "organisation", status: "under_review" });
    expect(consignmentNextStep("agreement", { ...owner, acceptHold })).toContain(
      "once we've checked Northbank Gallery's documents",
    );
  });
});
