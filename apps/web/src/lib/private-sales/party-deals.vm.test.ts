import { PRIVATE_SALE_DEAL_STAGES } from "@auction/types";
import { describe, expect, it } from "vitest";
import type { PartyDealRow } from "./party-deals.schema";
import {
  BUYER_STAGE_BADGES,
  SELLER_STAGE_BADGES,
  dealsForRole,
  needStep,
  privateSaleHref,
  rowFigure,
  stageBadge,
  stageSentence,
} from "./party-deals.vm";

function row(overrides: Partial<PartyDealRow> = {}): PartyDealRow {
  return {
    reference: "PS-0012",
    role: "buyer",
    stage: "invoiced",
    workTitle: "Harbour at dusk",
    workReference: "C-1042",
    priceMinor: 4_800_000,
    totalDueMinor: 4_800_000,
    netToSellerMinor: null,
    paymentDueAt: "2026-11-19T17:00:00.000Z",
    needs: "pay",
    updatedAt: "2026-11-10T10:00:00.000Z",
    ...overrides,
  };
}

describe("client wording", () => {
  it("never uses system terms for the client", () => {
    const words = [
      ...Object.values(BUYER_STAGE_BADGES).map((b) => b.label),
      ...Object.values(SELLER_STAGE_BADGES).map((b) => b.label),
    ].join(" ");
    expect(words).not.toMatch(/aml|kyc|screening|stripe|cleared|compliance/i);
  });

  it("describes every stage for both sides, in sentence case", () => {
    for (const stage of PRIVATE_SALE_DEAL_STAGES) {
      for (const role of ["buyer", "seller"] as const) {
        expect(stageBadge(role, stage).label).toMatch(/^[A-Z][a-z]/);
        expect(stageSentence(role, stage, "Thu 19 Nov").length).toBeGreaterThan(5);
      }
    }
  });

  it("says when to pay, to the buyer only", () => {
    expect(stageSentence("buyer", "invoiced", "Thu 19 Nov, 17:00 GMT")).toBe(
      "Your invoice is ready. Pay by Thu 19 Nov, 17:00 GMT.",
    );
    expect(stageSentence("seller", "invoiced", "Thu 19 Nov")).toBe("The buyer has been invoiced.");
  });
});

describe("needStep", () => {
  it("sends accepting the terms and paying to the deal, and checks to where they are done", () => {
    expect(needStep("accept_terms", "PS-0012").href).toBe("/private-sales/PS-0012");
    expect(needStep("pay", "PS-0012").label).toBe("Pay now");
    expect(needStep("verify_identity", "PS-0012").href).toBe("/verify-identity");
    expect(needStep("proof_of_funds", "PS-0012").href).toBe("/compliance/source-of-funds");
  });

  it("names the deal in the accessible name", () => {
    expect(needStep("pay", "PS-0012").accessibleName).toContain("PS-0012");
  });
});

describe("dealsForRole", () => {
  it("keeps each side to its own list and leaves cancelled deals out", () => {
    const rows = [
      row(),
      row({ reference: "PS-0013", role: "seller" }),
      row({ reference: "PS-0014", stage: "cancelled" }),
    ];
    expect(dealsForRole(rows, "buyer").map((r) => r.reference)).toEqual(["PS-0012"]);
    expect(dealsForRole(rows, "seller").map((r) => r.reference)).toEqual(["PS-0013"]);
  });
});

describe("rowFigure", () => {
  it("shows the buyer what is due, then what they paid", () => {
    expect(rowFigure(row())).toEqual({ value: 4_800_000, label: "Total due" });
    expect(rowFigure(row({ stage: "paid" }))?.label).toBe("Paid");
  });

  it("shows the seller what they receive, then what was paid out", () => {
    const seller = row({ role: "seller", totalDueMinor: null, netToSellerMinor: 4_055_000 });
    expect(rowFigure(seller)).toEqual({ value: 4_055_000, label: "You receive" });
    expect(rowFigure({ ...seller, stage: "settled" })?.label).toBe("Paid out");
  });

  it("shows no figure while the price is under discussion", () => {
    expect(rowFigure(row({ totalDueMinor: null, stage: "offer" }))).toBeNull();
  });
});

it("links to a private sale by its reference", () => {
  expect(privateSaleHref("PS-0012")).toBe("/private-sales/PS-0012");
});
