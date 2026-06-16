import type { BuyerSourceOfFundsView } from "@/lib/data/http/compliance.server";
import {
  buyerSofSubmitBlockReason,
  computeBuyerSofUploadCompletion,
  resolveBuyerSofNextStep,
} from "@/lib/data/view-models/buyer-sof.vm";
import { describe, expect, it } from "vitest";

function baseView(overrides: Partial<BuyerSourceOfFundsView> = {}): BuyerSourceOfFundsView {
  return {
    caseId: "sof-1",
    status: "pending",
    trigger: "threshold",
    documentsRequested: true,
    documentsSubmitted: false,
    documentRequestNote: null,
    requestedDocumentTypes: ["Bank statement", "Payslip"],
    documents: [],
    decisionOutcome: null,
    settlementSummary: null,
    settlementItemCount: 0,
    ...overrides,
  };
}

describe("computeBuyerSofUploadCompletion", () => {
  it("counts uploaded types excluding superseded", () => {
    const completion = computeBuyerSofUploadCompletion(
      baseView({
        documents: [
          {
            id: "d1",
            requestedType: "Bank statement",
            label: null,
            fileName: "stmt.pdf",
            statusLabel: "received",
            uploadedAt: "2026-01-01",
          },
        ],
      }),
    );
    expect(completion.uploadedCount).toBe(1);
    expect(completion.remainingCount).toBe(1);
    expect(completion.allUploaded).toBe(false);
  });
});

describe("buyerSofSubmitBlockReason", () => {
  it("blocks submit when no documents uploaded yet", () => {
    const reason = buyerSofSubmitBlockReason(baseView());
    expect(reason).toContain("at least one document");
  });

  it("blocks submit when types remain", () => {
    const reason = buyerSofSubmitBlockReason(
      baseView({
        documents: [
          {
            id: "d1",
            requestedType: "Bank statement",
            label: null,
            fileName: "stmt.pdf",
            statusLabel: "received",
            uploadedAt: "2026-01-01",
          },
        ],
      }),
    );
    expect(reason).toContain("1 remaining");
  });

  it("allows submit when all types uploaded", () => {
    const reason = buyerSofSubmitBlockReason(
      baseView({
        documents: [
          {
            id: "d1",
            requestedType: "Bank statement",
            label: null,
            fileName: "a.pdf",
            statusLabel: "received",
            uploadedAt: "2026-01-01",
          },
          {
            id: "d2",
            requestedType: "Payslip",
            label: null,
            fileName: "b.pdf",
            statusLabel: "received",
            uploadedAt: "2026-01-02",
          },
        ],
      }),
    );
    expect(reason).toBeNull();
  });
});

describe("resolveBuyerSofNextStep", () => {
  it("uses neutral under-review copy after submit", () => {
    const step = resolveBuyerSofNextStep(baseView({ documentsSubmitted: true }));
    expect(step.title).toBe("Submitted for review");
    expect(step.body).toContain("email");
  });

  it("uses clear copy for rejected outcomes", () => {
    const step = resolveBuyerSofNextStep(baseView({ decisionOutcome: "rejected" }));
    expect(step.title).toBe("Additional review needed");
  });
});
