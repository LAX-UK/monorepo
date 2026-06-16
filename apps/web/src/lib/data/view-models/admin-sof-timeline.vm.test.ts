import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import type { AdminSourceOfFundsRow } from "@/lib/data/http/compliance.server";
import { buildAdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import {
  buildSofTimeline,
  resolveSofNextAction,
  summarizeEvidenceSufficiency,
} from "@/lib/data/view-models/admin-sof-timeline.vm";
import { describe, expect, it } from "vitest";

function baseRow(overrides: Partial<AdminSourceOfFundsRow> = {}): AdminSourceOfFundsRow {
  return {
    id: "sof-1",
    userId: "user-1",
    status: "pending",
    trigger: "linked_transactions",
    thresholdAmount: "9000.00",
    exposureAmount: "12000.00",
    currency: "GBP",
    declaredSource: null,
    evidence: [],
    triageRecommendation: null,
    triagedByUserId: null,
    triagedAt: null,
    triageNotes: null,
    reviewedByUserId: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z",
    buyerEmail: "buyer@example.com",
    buyerName: null,
    buyerLabel: "buyer@example.com",
    settlementSummary: null,
    settlementItemCount: 1,
    pendingCasesForBuyer: 1,
    ...overrides,
  };
}

function baseDetail(overrides: Partial<AdminSourceOfFundsDetail> = {}): AdminSourceOfFundsDetail {
  const caseRow = baseRow();
  return {
    case: caseRow,
    buyer: { id: "user-1", email: "buyer@example.com", name: null, label: "buyer@example.com" },
    triagedBy: null,
    reviewedBy: null,
    exposureAtOpenPence: 1_200_000,
    currentActiveExposurePence: 1_200_000,
    settlementItems: [],
    blockedPayments: [],
    evidenceDownloads: [],
    documentRequest: {
      requestedAt: null,
      requestedByUserId: null,
      note: null,
      requestedDocumentTypes: [],
      submittedAt: null,
    },
    submittedDocuments: [],
    ...overrides,
  };
}

describe("buildSofTimeline", () => {
  it("marks only documents requested as current when awaiting buyer upload", () => {
    const row = buildAdminSofTableRow(baseRow());
    const detail = baseDetail({
      documentRequest: {
        requestedAt: "2026-01-02T10:00:00.000Z",
        requestedByUserId: "staff-1",
        note: null,
        requestedDocumentTypes: ["Bank statement"],
        submittedAt: null,
      },
    });

    const steps = buildSofTimeline({
      row,
      detail,
      canTriage: false,
      canDecide: false,
      currentUserId: "staff-1",
    });

    const requested = steps.find((s) => s.id === "requested");
    const upload = steps.find((s) => s.id === "upload");
    expect(requested?.state).toBe("current");
    expect(upload?.state).toBe("upcoming");
  });

  it("marks analyst triage as current turn when docs submitted", () => {
    const row = buildAdminSofTableRow(baseRow());
    const detail = baseDetail({
      documentRequest: {
        requestedAt: "2026-01-02T10:00:00.000Z",
        requestedByUserId: "staff-1",
        note: null,
        requestedDocumentTypes: ["Bank statement"],
        submittedAt: "2026-01-03T10:00:00.000Z",
      },
      submittedDocuments: [
        {
          id: "doc-1",
          requestedType: "Bank statement",
          label: null,
          fileName: "stmt.pdf",
          reviewStatus: "active",
          uploadedAt: "2026-01-03T10:00:00.000Z",
          uploadedByUserId: "user-1",
          downloadUrl: null,
          staffReview: null,
        },
      ],
    });

    const steps = buildSofTimeline({
      row,
      detail,
      canTriage: true,
      canDecide: false,
      currentUserId: "staff-1",
    });

    const triage = steps.find((s) => s.id === "triage");
    expect(triage?.state).toBe("current");
    expect(triage?.turnLabel).toContain("Your turn");
  });

  it("shows four-eyes turn label when MLRO triaged the case", () => {
    const row = buildAdminSofTableRow(
      baseRow({
        triageRecommendation: "recommend_approve",
        triagedByUserId: "staff-1",
        triagedAt: "2026-01-04T10:00:00.000Z",
      }),
    );
    const steps = buildSofTimeline({
      row,
      detail: baseDetail(),
      canTriage: false,
      canDecide: true,
      currentUserId: "staff-1",
    });

    const decision = steps.find((s) => s.id === "decision");
    expect(decision?.state).toBe("current");
    expect(decision?.turnLabel).toContain("different MLRO");
  });

  it("returns terminal outcome for approved cases", () => {
    const row = buildAdminSofTableRow(
      baseRow({
        status: "approved",
        reviewedAt: "2026-01-05T10:00:00.000Z",
      }),
    );
    const steps = buildSofTimeline({
      row,
      detail: baseDetail({ case: baseRow({ status: "approved" }) }),
      canTriage: false,
      canDecide: false,
      currentUserId: "staff-2",
    });

    expect(steps).toHaveLength(1);
    expect(steps[0]?.label).toBe("Approved");
  });
});

describe("resolveSofNextAction", () => {
  it("shows four-eyes block when the same MLRO triaged the case", () => {
    const row = buildAdminSofTableRow(
      baseRow({
        triageRecommendation: "recommend_approve",
        triagedByUserId: "staff-1",
      }),
    );
    const action = resolveSofNextAction(
      { row, detail: baseDetail() },
      { canTriage: false, canDecide: true, currentUserId: "staff-1" },
      "All documents reviewed.",
    );
    expect(action.title).toContain("different MLRO");
    expect(action.title).not.toBe("Next: MLRO decision");
  });
});

describe("summarizeEvidenceSufficiency", () => {
  it("reports all complete when every checklist item is checked", () => {
    const summary = summarizeEvidenceSufficiency([
      {
        id: "doc-1",
        requestedType: "Bank statement",
        label: null,
        fileName: "stmt.pdf",
        reviewStatus: "active",
        uploadedAt: "2026-01-03T10:00:00.000Z",
        uploadedByUserId: "user-1",
        downloadUrl: null,
        staffReview: {
          checks: {
            matchesDeclaredSource: true,
            coversExposure: true,
            recentEnough: true,
            legibleComplete: true,
          },
          note: null,
          reviewedAt: "2026-01-04T10:00:00.000Z",
          reviewedBy: { id: "staff-1", label: "Analyst" },
        },
      },
    ]);

    expect(summary.allComplete).toBe(true);
    expect(summary.summary).toContain("pass");
  });
});
