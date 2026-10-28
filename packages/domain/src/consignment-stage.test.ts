import { describe, expect, it } from "vitest";
import { type ConsignmentStageFacts, consignmentStage } from "./consignment-stage.js";

const unsoldLot = { status: "ended" as const, winnerId: null };

function facts(overrides: Partial<ConsignmentStageFacts>): ConsignmentStageFacts {
  return { submissionStatus: "converted", lot: unsoldLot, unsoldChoice: null, ...overrides };
}

describe("consignmentStage", () => {
  it("keeps the submission status before and during the sale", () => {
    expect(consignmentStage(facts({ submissionStatus: "under_review", lot: null }))).toBe(
      "under_review",
    );
    expect(consignmentStage(facts({ lot: { status: "active", winnerId: null } }))).toBe(
      "converted",
    );
    expect(consignmentStage(facts({ lot: { status: "ended", winnerId: "buyer" } }))).toBe(
      "converted",
    );
  });

  it("is unsold once the lot ends without a buyer and nobody has chosen", () => {
    expect(consignmentStage(facts({}))).toBe("unsold");
    expect(consignmentStage(facts({ lot: { status: "voided", winnerId: null } }))).toBe("unsold");
  });

  it.each([
    ["relist", "relist_requested"],
    ["private_sale", "private_sale_requested"],
    ["collect", "collect_requested"],
  ] as const)("follows a %s request", (choice, stage) => {
    expect(
      consignmentStage(
        facts({
          unsoldChoice: { status: "requested", requestedChoice: choice, decidedChoice: null },
        }),
      ),
    ).toBe(stage);
  });

  it("follows what the specialist confirmed, not what was asked", () => {
    expect(
      consignmentStage(
        facts({
          unsoldChoice: {
            status: "confirmed",
            requestedChoice: "relist",
            decidedChoice: "private_sale",
          },
        }),
      ),
    ).toBe("private_sale_confirmed");
  });
});
