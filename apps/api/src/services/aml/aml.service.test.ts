import { describe, expect, it, vi } from "vitest";
import { tryClaimProcessedWebhookEvent } from "../../lib/processed-webhook-event.js";
import { VERIFF_WATCHLIST_MATCH_FOUND } from "../../lib/veriff/veriff-watchlist-fixtures.js";
import { DefaultAmlDecisionPolicy } from "./aml-decision.policy.js";
import { AmlService } from "./aml.service.js";
import type {
  IAmlDecisionPolicy,
  IAmlHoldStore,
  IScreeningProvider,
  IWatchlistScreeningReader,
  IWatchlistScreeningWriter,
  WatchlistReviewOutcomeInput,
  WatchlistScreeningRecord,
  WatchlistTriageInput,
} from "./ports.js";

vi.mock("../../lib/processed-webhook-event.js", () => ({
  tryClaimProcessedWebhookEvent: vi.fn().mockResolvedValue({ claimed: true }),
}));

function makeRecord(partial: Partial<WatchlistScreeningRecord> = {}): WatchlistScreeningRecord {
  return {
    id: "scr_1",
    userId: "subject_1",
    provider: "veriff",
    providerSessionId: "sess_1",
    matchStatus: "possible_match",
    monitorStatus: "monitored",
    totalHits: 1,
    categories: ["pep"],
    hits: [],
    checkType: null,
    decisionOutcome: "review",
    reviewStatus: "pending",
    triageRecommendation: null,
    triagedByUserId: null,
    triagedAt: null,
    triageNotes: null,
    reviewedByUserId: null,
    reviewedAt: null,
    reviewNotes: null,
    screenedAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...partial,
  };
}

type Harness = {
  service: AmlService;
  record: WatchlistScreeningRecord;
  holds: Array<{ op: string; userId: string }>;
};

function makeService(initial: WatchlistScreeningRecord): Harness {
  const record = { ...initial };
  const holds: Array<{ op: string; userId: string }> = [];

  const db = {
    transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({}),
  } as never;

  const reader: IWatchlistScreeningReader = {
    async findById() {
      return record;
    },
    async findLatestByUserId() {
      return record;
    },
    async findByProviderSessionId() {
      return record;
    },
    async listByReviewStatus() {
      return [record];
    },
    async listForUser() {
      return [record];
    },
  };

  const writer: IWatchlistScreeningWriter = {
    async upsertFromResult() {
      return record;
    },
    async setTriage(_id: string, input: WatchlistTriageInput) {
      record.triageRecommendation = input.recommendation;
      record.triagedByUserId = input.triagedByUserId;
      record.triageNotes = input.triageNotes;
      record.triagedAt = new Date();
      return record;
    },
    async setReviewOutcome(_id: string, input: WatchlistReviewOutcomeInput) {
      record.reviewStatus = input.reviewStatus;
      record.reviewedByUserId = input.reviewedByUserId;
      record.reviewNotes = input.reviewNotes;
      record.reviewedAt = new Date();
      return record;
    },
    async setMonitorStatus() {},
  };

  const holdStore: IAmlHoldStore = {
    async setHold(userId) {
      holds.push({ op: "set", userId });
    },
    async clearHold(userId) {
      holds.push({ op: "clear", userId });
    },
    async getHold() {
      return null;
    },
  };

  const policy: IAmlDecisionPolicy = {
    evaluate() {
      return { outcome: "review", reasons: [] };
    },
  };

  const events = { publish: async () => {} } as never;
  const provider: IScreeningProvider = {
    isConfigured: () => false,
    async enableOngoingMonitoring() {},
    async disableOngoingMonitoring() {},
  };

  const service = new AmlService(
    db,
    { verify: () => {} } as never,
    policy,
    writer,
    reader,
    holdStore,
    events,
    provider,
    null,
  );

  return { service, record, holds };
}

describe("AmlService two-stage maker-checker", () => {
  it("triage records an advisory recommendation without touching the hold", async () => {
    const h = makeService(makeRecord());
    const triaged = await h.service.triage({
      screeningId: "scr_1",
      analystUserId: "analyst_1",
      recommendation: "clear",
      notes: "false positive",
    });
    expect(triaged.triageRecommendation).toBe("recommend_clear");
    expect(triaged.triagedByUserId).toBe("analyst_1");
    expect(triaged.reviewStatus).toBe("pending");
    expect(h.holds).toHaveLength(0);
  });

  it("forbids the subject from triaging their own screening", async () => {
    const h = makeService(makeRecord());
    await expect(
      h.service.triage({
        screeningId: "scr_1",
        analystUserId: "subject_1",
        recommendation: "clear",
        notes: null,
      }),
    ).rejects.toThrow("aml_triage_self_forbidden");
  });

  it("decide requires a prior triage", async () => {
    const h = makeService(makeRecord());
    await expect(
      h.service.decide({
        screeningId: "scr_1",
        reviewerUserId: "mlro_1",
        decision: "clear",
        notes: null,
      }),
    ).rejects.toThrow("aml_triage_required");
  });

  it("decide forbids the triager from finalising (maker != checker)", async () => {
    const h = makeService(makeRecord());
    await h.service.triage({
      screeningId: "scr_1",
      analystUserId: "analyst_1",
      recommendation: "clear",
      notes: null,
    });
    await expect(
      h.service.decide({
        screeningId: "scr_1",
        reviewerUserId: "analyst_1",
        decision: "clear",
        notes: null,
      }),
    ).rejects.toThrow("aml_review_same_as_triager");
  });

  it("decide forbids the subject from finalising their own screening", async () => {
    const h = makeService(makeRecord());
    await h.service.triage({
      screeningId: "scr_1",
      analystUserId: "analyst_1",
      recommendation: "clear",
      notes: null,
    });
    await expect(
      h.service.decide({
        screeningId: "scr_1",
        reviewerUserId: "subject_1",
        decision: "clear",
        notes: null,
      }),
    ).rejects.toThrow("aml_review_self_forbidden");
  });

  it("clears the hold once triaged and decided by distinct users", async () => {
    const h = makeService(makeRecord());
    await h.service.triage({
      screeningId: "scr_1",
      analystUserId: "analyst_1",
      recommendation: "clear",
      notes: null,
    });
    const decided = await h.service.decide({
      screeningId: "scr_1",
      reviewerUserId: "mlro_1",
      decision: "clear",
      notes: "verified not a match",
    });
    expect(decided.reviewStatus).toBe("cleared");
    expect(decided.reviewedByUserId).toBe("mlro_1");
    expect(h.holds).toContainEqual({ op: "clear", userId: "subject_1" });
  });

  it("blocks the subject when the MLRO decides block", async () => {
    const h = makeService(makeRecord());
    await h.service.triage({
      screeningId: "scr_1",
      analystUserId: "analyst_1",
      recommendation: "block",
      notes: null,
    });
    const decided = await h.service.decide({
      screeningId: "scr_1",
      reviewerUserId: "mlro_1",
      decision: "block",
      notes: "confirmed sanctions",
    });
    expect(decided.reviewStatus).toBe("blocked");
    expect(h.holds).toContainEqual({ op: "set", userId: "subject_1" });
  });

  it("rejects triage on a non-pending screening", async () => {
    const h = makeService(makeRecord({ reviewStatus: "cleared" }));
    await expect(
      h.service.triage({
        screeningId: "scr_1",
        analystUserId: "analyst_1",
        recommendation: "block",
        notes: null,
      }),
    ).rejects.toThrow("aml_screening_not_pending");
  });

  it("rejects second triage on the same screening", async () => {
    const h = makeService(makeRecord());
    await h.service.triage({
      screeningId: "scr_1",
      analystUserId: "analyst_1",
      recommendation: "clear",
      notes: null,
    });
    await expect(
      h.service.triage({
        screeningId: "scr_1",
        analystUserId: "analyst_2",
        recommendation: "block",
        notes: null,
      }),
    ).rejects.toThrow("aml_triage_already_set");
  });

  it("rejects decide on a non-pending screening", async () => {
    const h = makeService(makeRecord({ reviewStatus: "cleared" }));
    await expect(
      h.service.decide({
        screeningId: "scr_1",
        reviewerUserId: "mlro_1",
        decision: "clear",
        notes: null,
      }),
    ).rejects.toThrow("aml_screening_not_pending");
  });
});

describe("AmlService watchlist webhook ingest", () => {
  it("processes documented Veriff match_found payload", async () => {
    vi.mocked(tryClaimProcessedWebhookEvent).mockResolvedValue({ claimed: true });
    const holds: Array<{ op: string; userId: string }> = [];
    let upsertInput: Parameters<IWatchlistScreeningWriter["upsertFromResult"]>[0] | undefined;

    const db = {
      transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn({}),
    } as never;

    const writer: IWatchlistScreeningWriter = {
      async upsertFromResult(input) {
        upsertInput = input;
        return makeRecord({
          userId: input.userId,
          categories: input.result.categories,
          matchStatus: input.result.matchStatus,
          monitorStatus: input.result.monitorStatus,
          hits: input.result.hits,
          checkType: input.checkType ?? null,
        });
      },
      async setTriage() {
        return makeRecord();
      },
      async setReviewOutcome() {
        return makeRecord();
      },
      async setMonitorStatus() {},
    };

    const reader: IWatchlistScreeningReader = {
      async findById() {
        return makeRecord();
      },
      async findLatestByUserId() {
        return makeRecord();
      },
      async findByProviderSessionId() {
        return makeRecord();
      },
      async listByReviewStatus() {
        return [];
      },
      async listForUser() {
        return [];
      },
    };

    const holdStore: IAmlHoldStore = {
      async setHold(userId) {
        holds.push({ op: "set", userId });
      },
      async clearHold(userId) {
        holds.push({ op: "clear", userId });
      },
      async getHold() {
        return null;
      },
    };

    const provider: IScreeningProvider = {
      isConfigured: () => false,
      async enableOngoingMonitoring() {},
      async disableOngoingMonitoring() {},
    };

    const service = new AmlService(
      db,
      { verify: () => {} } as never,
      new DefaultAmlDecisionPolicy(),
      writer,
      reader,
      holdStore,
      { publish: async () => {} } as never,
      provider,
      null,
    );

    const rawBody = JSON.stringify(VERIFF_WATCHLIST_MATCH_FOUND);
    const result = await service.handleWatchlistWebhook(rawBody, "sig", "key");

    expect(result.processed).toBe(true);
    expect(result.outcome).toBe("review");
    expect(upsertInput?.userId).toBe("user_test_123");
    expect(upsertInput?.checkType).toBe("initial_result");
    expect(upsertInput?.result.categories).toEqual(
      expect.arrayContaining(["pep", "sanction", "adverse_media"]),
    );
    expect(upsertInput?.result.monitorStatus).toBe("monitored");
    expect(holds).toContainEqual({ op: "set", userId: "user_test_123" });
  });
});
