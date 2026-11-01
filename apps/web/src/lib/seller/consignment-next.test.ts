import { agreementAcceptanceHold } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { consignmentNextLink, consignmentNextStep } from "./consignment-next";

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

describe("consignmentNextStep for a sold consignment", () => {
  const base = { canAccept: true, organisation: null, chooseBy: null };
  const payout = { id: "p1", settledAt: new Date("2026-11-12T10:00:00Z") };

  it("waits for the buyer until they pay", () => {
    const sold = { stage: "buyer_paying", payout: null } as const;
    expect(consignmentNextStep("sold", { ...base, sold })).toContain("once the buyer pays");
    expect(consignmentNextLink("sold", { sold, submissionId: "s1" })).toBeNull();
  });

  it("says the payout is scheduled once the buyer paid, and links it", () => {
    const sold = { stage: "in_payout", payout: { id: "p1", settledAt: null } } as const;
    const next = consignmentNextStep("sold", { ...base, sold });
    expect(next).toContain("buyer has paid");
    expect(next).not.toContain("once the buyer pays");
    expect(consignmentNextLink("sold", { sold, submissionId: "s1" })).toEqual({
      label: "View payout",
      href: "/selling/payouts/p1",
    });
  });

  it("says when it was paid out, never that the buyer still has to pay", () => {
    const sold = { stage: "paid_out", payout } as const;
    expect(consignmentNextStep("sold", { ...base, sold })).toBe(
      "It sold and was paid out on 12 Nov 2026.",
    );
    expect(consignmentNextLink("sold", { sold, submissionId: "s1" })?.href).toBe(
      "/selling/payouts/p1",
    );
  });

  it("does not promise money for a refunded sale", () => {
    const sold = { stage: "refunded", payout: null } as const;
    expect(consignmentNextStep("sold", { ...base, sold })).toContain("refunded");
  });

  it("does not guess the payout for a member who cannot see payouts", () => {
    expect(consignmentNextStep("sold", { ...base, sold: null })).not.toContain(
      "once the buyer pays",
    );
    expect(consignmentNextLink("sold", { sold: null, submissionId: "s1" })).toBeNull();
  });

  it("links nothing for other statuses", () => {
    expect(
      consignmentNextLink("live", { sold: { stage: "paid_out", payout }, submissionId: "s1" }),
    ).toBeNull();
  });
});

describe("a payout problem", () => {
  it("sends the seller to the consignment's messages", () => {
    const sold = { stage: "payout_problem", payout: null } as const;
    expect(consignmentNextLink("sold", { sold, submissionId: "s1" })).toEqual({
      label: "Message your specialist about this payout",
      href: "/selling/consignments/s1?tab=messages",
    });
  });
});
