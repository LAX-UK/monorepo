import type { ConsignmentAgreement, EntityDocument } from "@auction/types";
import { describe, expect, it } from "vitest";
import { type ConsignmentDocumentsSources, consignmentDocuments } from "./consignment-documents";

const agreement: ConsignmentAgreement = {
  id: "a1",
  submissionId: "s1",
  legalEntityId: "e1",
  termsVersion: "v1",
  estimateLow: "8000.00",
  estimateHigh: "12000.00",
  reservePrice: null,
  commissionPercent: "12.00",
  relistReserveFloor: null,
  currency: "GBP",
  proposedAt: new Date("2026-10-27T10:00:00Z"),
  acceptedAt: null,
  acceptedByUserId: null,
  acceptedByName: null,
};

const conditionReport: EntityDocument = {
  id: "d1",
  entityKind: "lot",
  entityId: "l1",
  kind: "condition_report",
  label: null,
  uploadObjectId: "o1",
  downloadUrl: "https://files.example/cr.pdf",
  fileName: "scan-0012.PDF",
  byteSize: 1_900_000,
  contentType: "application/pdf",
  createdByUserId: null,
  createdAt: new Date("2026-10-28T10:00:00Z"),
};

function input(overrides: Partial<ConsignmentDocumentsSources> = {}): ConsignmentDocumentsSources {
  return {
    submissionId: "s1",
    sellerEntityId: "e1",
    agreement,
    lotDocuments: [conditionReport, { ...conditionReport, id: "d2", kind: "provenance" }],
    payout: { id: "p1", settledAt: new Date("2026-10-30T10:00:00Z") },
    sold: true,
    canSeePayouts: true,
    ...overrides,
  };
}

describe("consignmentDocuments", () => {
  it("lists the agreement, the condition report and the statement, each opened through the app", () => {
    const view = consignmentDocuments(input());
    // Dates keep their spaces non-breaking, so they never wrap between day and month.
    const plain = (note: string | null) => note?.replace(/ /g, " ") ?? null;
    expect(view.fromLax.map((row) => [row.name, row.href, plain(row.note)])).toEqual([
      ["Consignment agreement.pdf", "/selling/consignments/s1/agreement", "Sent 27 Oct 2026"],
      ["Condition report.pdf", "https://files.example/cr.pdf", "28 Oct 2026"],
      ["Payout statement.pdf", "/legal-entities/e1/payouts/p1/statement", "Paid out 30 Oct 2026"],
    ]);
    expect(view.fromLax[1]?.size).toBe("1.8 MB");
    expect(view.statementHidden).toBe(false);
  });

  it("keeps no agreement until its terms are set", () => {
    const view = consignmentDocuments(
      input({ agreement: { ...agreement, estimateLow: null }, lotDocuments: [], payout: null }),
    );
    expect(view.fromLax).toEqual([]);
  });

  it("says the statement is held back from a member who does not see payouts", () => {
    const view = consignmentDocuments(input({ canSeePayouts: false }));
    expect(view.fromLax.some((row) => row.name === "Payout statement.pdf")).toBe(false);
    expect(view.statementHidden).toBe(true);
  });
});
