import { describe, expect, it } from "vitest";
import { SourceOfFundsService } from "./source-of-funds.service.js";
import type {
  CreateSourceOfFundsCaseInput,
  ISourceOfFundsRepository,
  SourceOfFundsCase,
  SourceOfFundsReviewInput,
  SourceOfFundsStatus,
  SourceOfFundsTriageInput,
} from "./source-of-funds.types.js";

type FakeState = {
  cases: SourceOfFundsCase[];
  linkedPence: number;
};

function makeCase(
  partial: Partial<SourceOfFundsCase> & Pick<SourceOfFundsCase, "id" | "userId">,
): SourceOfFundsCase {
  return {
    status: "pending",
    trigger: "threshold",
    thresholdAmount: "9000.00",
    exposureAmount: "9000.00",
    currency: "GBP",
    declaredSource: null,
    evidence: [],
    documentsRequestedAt: null,
    documentsRequestedByUserId: null,
    documentRequestNote: null,
    requestedDocumentTypes: [],
    documentsSubmittedAt: null,
    triageRecommendation: null,
    triagedByUserId: null,
    triagedAt: null,
    triageNotes: null,
    reviewedByUserId: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...partial,
  };
}

function fakeRepo(state: FakeState): ISourceOfFundsRepository {
  return {
    async findLatestForUser(userId) {
      const forUser = state.cases.filter((c) => c.userId === userId);
      return forUser[forUser.length - 1] ?? null;
    },
    async findById(id) {
      return state.cases.find((c) => c.id === id) ?? null;
    },
    async findLatestApprovedForUser(userId) {
      const approved = state.cases.filter((c) => c.userId === userId && c.status === "approved");
      return approved[approved.length - 1] ?? null;
    },
    async findPendingForUser(userId) {
      const pending = state.cases.filter((c) => c.userId === userId && c.status === "pending");
      return pending[0] ?? null;
    },
    async listByStatus(status: SourceOfFundsStatus) {
      return state.cases.filter((c) => c.status === status);
    },
    async countByStatus(status: SourceOfFundsStatus) {
      return state.cases.filter((c) => c.status === status).length;
    },
    async create(input: CreateSourceOfFundsCaseInput) {
      const created = makeCase({
        id: `sof_${state.cases.length + 1}`,
        userId: input.userId,
        trigger: input.trigger,
        thresholdAmount: input.thresholdAmount,
        exposureAmount: input.exposureAmount,
        currency: input.currency,
      });
      state.cases.push(created);
      return created;
    },
    async setTriage(input: SourceOfFundsTriageInput) {
      const existing = state.cases.find((c) => c.id === input.id);
      if (!existing) return null;
      existing.triageRecommendation = input.recommendation;
      existing.triagedByUserId = input.triagedByUserId;
      existing.triageNotes = input.triageNotes;
      existing.triagedAt = new Date();
      return existing;
    },
    async setReview(input: SourceOfFundsReviewInput) {
      const existing = state.cases.find((c) => c.id === input.id);
      if (!existing) return null;
      existing.status = input.status;
      existing.reviewedByUserId = input.reviewedByUserId;
      existing.reviewNotes = input.reviewNotes;
      existing.reviewedAt = new Date();
      return existing;
    },
    async reopenRejected(id: string) {
      const existing = state.cases.find((c) => c.id === id && c.status === "rejected");
      if (!existing) return null;
      existing.status = "pending";
      existing.triageRecommendation = null;
      existing.triagedByUserId = null;
      existing.triagedAt = null;
      existing.triageNotes = null;
      existing.reviewedByUserId = null;
      existing.reviewedAt = null;
      existing.reviewNotes = null;
      return existing;
    },
    async setDocumentRequest(input) {
      const existing = state.cases.find((c) => c.id === input.id);
      if (!existing) return null;
      existing.documentsRequestedAt = new Date();
      existing.documentsRequestedByUserId = input.requestedByUserId;
      existing.documentRequestNote = input.note;
      existing.requestedDocumentTypes = input.documentTypes;
      existing.documentsSubmittedAt = null;
      return existing;
    },
    async setDocumentsSubmitted(id) {
      const existing = state.cases.find((c) => c.id === id);
      if (!existing) return null;
      existing.documentsSubmittedAt = new Date();
      return existing;
    },
    async resetDocumentCycle(id) {
      const existing = state.cases.find((c) => c.id === id);
      if (!existing) return;
      existing.documentsRequestedAt = null;
      existing.documentsRequestedByUserId = null;
      existing.documentRequestNote = null;
      existing.requestedDocumentTypes = [];
      existing.documentsSubmittedAt = null;
    },
    async sumActiveBuyerSettlementPence(_userId: string, excludePaymentId?: string) {
      if (excludePaymentId === "pay_double") {
        return 0;
      }
      return state.linkedPence;
    },
    async listForUser(userId, limit = 50) {
      return state.cases.filter((c) => c.userId === userId).slice(0, limit);
    },
    async countPendingByUserIds(userIds) {
      const map = new Map<string, number>();
      for (const id of userIds) {
        map.set(id, state.cases.filter((c) => c.userId === id && c.status === "pending").length);
      }
      return map;
    },
  };
}

const config = { thresholdAmount: 9000, currency: "GBP", approvalValidityDays: 365 };

describe("SourceOfFundsService.hasPendingCaseForUser", () => {
  it("is false when the buyer has no SoF case", async () => {
    const state: FakeState = { cases: [], linkedPence: 0 };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    expect(await svc.hasPendingCaseForUser("u1")).toBe(false);
  });

  it("is true when the buyer's latest case is pending", async () => {
    const state: FakeState = {
      cases: [makeCase({ id: "sof_1", userId: "u1", status: "pending" })],
      linkedPence: 0,
    };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    expect(await svc.hasPendingCaseForUser("u1")).toBe(true);
  });

  it("is false when the latest case is approved", async () => {
    const state: FakeState = {
      cases: [makeCase({ id: "sof_1", userId: "u1", status: "approved" })],
      linkedPence: 0,
    };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    expect(await svc.hasPendingCaseForUser("u1")).toBe(false);
  });

  it("is true when a pending case sits behind a newer approved case", async () => {
    const state: FakeState = {
      cases: [
        makeCase({
          id: "sof_pending",
          userId: "u1",
          status: "pending",
          createdAt: new Date("2026-01-01T00:00:00Z"),
        }),
        makeCase({
          id: "sof_approved",
          userId: "u1",
          status: "approved",
          reviewedAt: new Date("2026-02-01T00:00:00Z"),
          createdAt: new Date("2026-02-01T00:00:00Z"),
        }),
      ],
      linkedPence: 0,
    };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    expect(await svc.hasPendingCaseForUser("u1")).toBe(true);
  });

  it("does not open a case as a side effect", async () => {
    const state: FakeState = { cases: [], linkedPence: 0 };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    await svc.hasPendingCaseForUser("u1");
    expect(state.cases).toHaveLength(0);
  });
});

describe("SourceOfFundsService.requiresSourceOfFunds", () => {
  it("does not require SoF below the threshold", async () => {
    const state: FakeState = { cases: [], linkedPence: 0 };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    expect(await svc.requiresSourceOfFunds({ buyerUserId: "u1", amountPence: 100_000 })).toBe(
      false,
    );
    expect(state.cases).toHaveLength(0);
  });

  it("requires SoF on a single transaction at/above the threshold and opens a case", async () => {
    const state: FakeState = { cases: [], linkedPence: 0 };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    expect(await svc.requiresSourceOfFunds({ buyerUserId: "u1", amountPence: 900_000 })).toBe(true);
    expect(state.cases).toHaveLength(1);
    expect(state.cases[0]?.trigger).toBe("threshold");
  });

  it("aggregates linked transactions toward the threshold", async () => {
    const state: FakeState = { cases: [], linkedPence: 800_000 };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    // 8000 linked + 2000 current = 10000 >= 9000 threshold
    expect(await svc.requiresSourceOfFunds({ buyerUserId: "u1", amountPence: 200_000 })).toBe(true);
    expect(state.cases[0]?.trigger).toBe("linked_transactions");
  });

  it("does not duplicate a pending case", async () => {
    const state: FakeState = { cases: [], linkedPence: 0 };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    await svc.requiresSourceOfFunds({ buyerUserId: "u1", amountPence: 900_000 });
    await svc.requiresSourceOfFunds({ buyerUserId: "u1", amountPence: 900_000 });
    expect(state.cases).toHaveLength(1);
  });

  it("reuses an open pending case behind a newer (no-longer-valid) approved case", async () => {
    // Regression: a pending case can sit behind a newer terminal case (or rows
    // tied on created_at). Checking only the latest row created duplicate
    // pending cases — and duplicate review tasks — on every checkout retry.
    const state: FakeState = {
      cases: [
        makeCase({
          id: "sof_pending",
          userId: "u1",
          status: "pending",
          exposureAmount: "10000.00",
          createdAt: new Date("2026-01-01T00:00:00Z"),
        }),
        makeCase({
          id: "sof_approved",
          userId: "u1",
          status: "approved",
          // Small approved exposure → no longer valid once exposure grows.
          exposureAmount: "9000.00",
          reviewedByUserId: "mlro_1",
          reviewedAt: new Date("2026-02-01T00:00:00Z"),
          createdAt: new Date("2026-02-01T00:00:00Z"),
        }),
      ],
      linkedPence: 0,
    };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    // Exposure (90000) ≥ approved (9000) + threshold (9000) → approval invalid,
    // so the gate must (re)open review — but reuse the existing pending case.
    expect(await svc.requiresSourceOfFunds({ buyerUserId: "u1", amountPence: 9_000_000 })).toBe(
      true,
    );
    expect(state.cases).toHaveLength(2);
    expect(state.cases.filter((c) => c.status === "pending")).toHaveLength(1);
  });

  it("reuses the pending case when create races on the unique index", async () => {
    const pendingCase = makeCase({
      id: "sof_pending",
      userId: "u1",
      status: "pending",
      exposureAmount: "9000.00",
    });
    const state: FakeState = { cases: [pendingCase], linkedPence: 0 };
    const base = fakeRepo(state);
    let pendingReads = 0;
    const repo: ISourceOfFundsRepository = {
      ...base,
      async findPendingForUser(userId, conn) {
        pendingReads += 1;
        if (pendingReads === 1) return null;
        return base.findPendingForUser(userId, conn);
      },
      async create() {
        throw Object.assign(new Error("duplicate key value violates unique constraint"), {
          code: "23505",
        });
      },
    };
    const svc = new SourceOfFundsService(repo, config);
    expect(await svc.requiresSourceOfFunds({ buyerUserId: "u1", amountPence: 900_000 })).toBe(true);
    expect(state.cases).toHaveLength(1);
    expect(pendingReads).toBeGreaterThanOrEqual(2);
  });

  it("clears while a valid approved case is on file", async () => {
    const state: FakeState = {
      cases: [
        makeCase({
          id: "sof_1",
          userId: "u1",
          status: "approved",
          exposureAmount: "9000.00",
          reviewedByUserId: "mlro_1",
          reviewedAt: new Date(),
        }),
      ],
      linkedPence: 0,
    };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    expect(await svc.requiresSourceOfFunds({ buyerUserId: "u1", amountPence: 900_000 })).toBe(
      false,
    );
    expect(state.cases).toHaveLength(1);
  });

  it("re-triggers when exposure grows materially beyond the approved amount", async () => {
    const state: FakeState = {
      cases: [
        makeCase({
          id: "sof_1",
          userId: "u1",
          status: "approved",
          exposureAmount: "9000.00",
          reviewedByUserId: "mlro_1",
          reviewedAt: new Date(),
        }),
      ],
      // 9000 approved + another full 9000 threshold of new exposure → re-validate
      linkedPence: 900_000,
    };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    expect(await svc.requiresSourceOfFunds({ buyerUserId: "u1", amountPence: 900_000 })).toBe(true);
    expect(state.cases).toHaveLength(2);
    expect(state.cases[1]?.status).toBe("pending");
  });

  it("re-triggers when the approval is older than the validity window", async () => {
    const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    const state: FakeState = {
      cases: [
        makeCase({
          id: "sof_1",
          userId: "u1",
          status: "approved",
          exposureAmount: "9000.00",
          reviewedByUserId: "mlro_1",
          reviewedAt: old,
        }),
      ],
      linkedPence: 0,
    };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    expect(await svc.requiresSourceOfFunds({ buyerUserId: "u1", amountPence: 900_000 })).toBe(true);
    expect(state.cases).toHaveLength(2);
  });

  it("keeps blocking on a rejected case without opening a new one (no churn)", async () => {
    const state: FakeState = {
      cases: [
        makeCase({
          id: "sof_1",
          userId: "u1",
          status: "rejected",
          reviewedByUserId: "mlro_1",
          reviewedAt: new Date(),
        }),
      ],
      linkedPence: 0,
    };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    expect(await svc.requiresSourceOfFunds({ buyerUserId: "u1", amountPence: 900_000 })).toBe(true);
    await svc.requiresSourceOfFunds({ buyerUserId: "u1", amountPence: 900_000 });
    expect(state.cases).toHaveLength(1);
  });

  it("is disabled when the threshold is zero", async () => {
    const state: FakeState = { cases: [], linkedPence: 0 };
    const svc = new SourceOfFundsService(fakeRepo(state), {
      thresholdAmount: 0,
      currency: "GBP",
      approvalValidityDays: 365,
    });
    expect(await svc.requiresSourceOfFunds({ buyerUserId: "u1", amountPence: 900_000 })).toBe(
      false,
    );
  });
});

describe("SourceOfFundsService two-stage maker-checker", () => {
  it("triage records an advisory recommendation without changing status", async () => {
    const state: FakeState = {
      cases: [makeCase({ id: "sof_1", userId: "u1" })],
      linkedPence: 0,
    };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    const triaged = await svc.triage({
      caseId: "sof_1",
      analystUserId: "analyst_1",
      recommendation: "approve",
      notes: "looks legit",
    });
    expect(triaged.status).toBe("pending");
    expect(triaged.triageRecommendation).toBe("recommend_approve");
    expect(triaged.triagedByUserId).toBe("analyst_1");
  });

  it("forbids the subject from triaging their own case", async () => {
    const state: FakeState = {
      cases: [makeCase({ id: "sof_1", userId: "u1" })],
      linkedPence: 0,
    };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    await expect(
      svc.triage({ caseId: "sof_1", analystUserId: "u1", recommendation: "approve", notes: null }),
    ).rejects.toThrow("source_of_funds_triage_self_forbidden");
  });

  it("decide requires a prior triage", async () => {
    const state: FakeState = {
      cases: [makeCase({ id: "sof_1", userId: "u1" })],
      linkedPence: 0,
    };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    await expect(
      svc.decide({ caseId: "sof_1", reviewerUserId: "mlro_1", decision: "approve", notes: null }),
    ).rejects.toThrow("source_of_funds_triage_required");
  });

  it("decide forbids the triager from finalising (maker != checker)", async () => {
    const state: FakeState = {
      cases: [makeCase({ id: "sof_1", userId: "u1" })],
      linkedPence: 0,
    };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    await svc.triage({
      caseId: "sof_1",
      analystUserId: "analyst_1",
      recommendation: "approve",
      notes: null,
    });
    await expect(
      svc.decide({
        caseId: "sof_1",
        reviewerUserId: "analyst_1",
        decision: "approve",
        notes: null,
      }),
    ).rejects.toThrow("source_of_funds_review_same_as_triager");
  });

  it("decide forbids the subject from finalising their own case", async () => {
    const state: FakeState = {
      cases: [makeCase({ id: "sof_1", userId: "u1" })],
      linkedPence: 0,
    };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    await svc.triage({
      caseId: "sof_1",
      analystUserId: "analyst_1",
      recommendation: "approve",
      notes: null,
    });
    await expect(
      svc.decide({ caseId: "sof_1", reviewerUserId: "u1", decision: "approve", notes: null }),
    ).rejects.toThrow("source_of_funds_review_self_forbidden");
  });

  it("approves once triaged and decided by distinct users", async () => {
    const state: FakeState = {
      cases: [makeCase({ id: "sof_1", userId: "u1" })],
      linkedPence: 0,
    };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    await svc.triage({
      caseId: "sof_1",
      analystUserId: "analyst_1",
      recommendation: "approve",
      notes: null,
    });
    const decided = await svc.decide({
      caseId: "sof_1",
      reviewerUserId: "mlro_1",
      decision: "approve",
      notes: "Bank statements verified",
    });
    expect(decided.status).toBe("approved");
    expect(decided.reviewedByUserId).toBe("mlro_1");
  });

  it("rejects second triage on the same case", async () => {
    const state: FakeState = {
      cases: [makeCase({ id: "sof_1", userId: "u1" })],
      linkedPence: 0,
    };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    await svc.triage({
      caseId: "sof_1",
      analystUserId: "analyst_1",
      recommendation: "approve",
      notes: null,
    });
    await expect(
      svc.triage({
        caseId: "sof_1",
        analystUserId: "analyst_2",
        recommendation: "reject",
        notes: null,
      }),
    ).rejects.toThrow("source_of_funds_triage_already_set");
  });

  it("rejects decide on a non-pending case", async () => {
    const state: FakeState = {
      cases: [makeCase({ id: "sof_1", userId: "u1", status: "approved" })],
      linkedPence: 0,
    };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    await expect(
      svc.decide({ caseId: "sof_1", reviewerUserId: "mlro_1", decision: "approve", notes: null }),
    ).rejects.toThrow("source_of_funds_not_pending");
  });

  it("does not double-count the current payment when excludePaymentId is set", async () => {
    const paymentPence = 1_000_000;
    const approvedCase = makeCase({
      id: "sof_approved",
      userId: "u1",
      status: "approved",
      exposureAmount: "10000.00",
      reviewedAt: new Date(),
    });
    const withExclude = await new SourceOfFundsService(
      fakeRepo({ cases: [approvedCase], linkedPence: paymentPence }),
      config,
    ).requiresSourceOfFunds({
      buyerUserId: "u1",
      amountPence: paymentPence,
      excludePaymentId: "pay_double",
    });
    expect(withExclude).toBe(false);

    const withoutExclude = await new SourceOfFundsService(
      fakeRepo({ cases: [structuredClone(approvedCase)], linkedPence: paymentPence }),
      config,
    ).requiresSourceOfFunds({
      buyerUserId: "u1",
      amountPence: paymentPence,
    });
    expect(withoutExclude).toBe(true);
  });

  it("reopens a rejected case to pending", async () => {
    const state: FakeState = {
      cases: [
        makeCase({
          id: "sof_1",
          userId: "u1",
          status: "rejected",
          triageRecommendation: "recommend_reject",
          triagedByUserId: "analyst_1",
          reviewedByUserId: "mlro_1",
        }),
      ],
      linkedPence: 0,
    };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    const reopened = await svc.reopenRejected({ caseId: "sof_1", actorUserId: "mlro_2" });
    expect(reopened.status).toBe("pending");
    expect(reopened.triageRecommendation).toBeNull();
    expect(reopened.reviewedByUserId).toBeNull();
  });

  it("throws when the case does not exist", async () => {
    const state: FakeState = { cases: [], linkedPence: 0 };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    await expect(
      svc.triage({
        caseId: "missing",
        analystUserId: "analyst_1",
        recommendation: "reject",
        notes: null,
      }),
    ).rejects.toThrow("source_of_funds_not_found");
  });
});

describe("SourceOfFundsService listByStatus", () => {
  it("lists and counts approved cases", async () => {
    const state: FakeState = {
      cases: [
        makeCase({ id: "sof_pending", userId: "u1", status: "pending" }),
        makeCase({ id: "sof_approved", userId: "u2", status: "approved" }),
        makeCase({ id: "sof_rejected", userId: "u3", status: "rejected" }),
      ],
      linkedPence: 0,
    };
    const svc = new SourceOfFundsService(fakeRepo(state), config);
    const approved = await svc.listByStatus("approved");
    expect(approved).toHaveLength(1);
    expect(approved[0]?.id).toBe("sof_approved");
    expect(await svc.countByStatus("approved")).toBe(1);
  });
});
