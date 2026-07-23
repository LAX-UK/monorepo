import type { IEmailService } from "@auction/email";
import { describe, expect, it, vi } from "vitest";
import { processAmlMatchReview } from "./aml-match-review.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never;

function makeEmail(): IEmailService {
  return { enqueue: vi.fn().mockResolvedValue(undefined) } as unknown as IEmailService;
}

function makeCtx(overrides: Partial<ProjectorRunContext> = {}): ProjectorRunContext {
  return {
    projectorStateRepo: {
      ensureCursor: vi.fn(),
      getCursor: vi.fn().mockResolvedValue(0),
      advanceCursor: vi.fn(),
      advanceCursorLiteralName: vi.fn(),
      recordError: vi.fn(),
    },
    domainEventReader: {
      listAfterCursor: vi.fn().mockResolvedValue([]),
      getById: vi.fn(),
      listLockedForProjector: vi.fn(),
    },
    projectorFailureRecorder: { record: vi.fn() },
    transactionRunner: { runInTransaction: vi.fn() },
    notificationWriteRepo: { createMany: vi.fn() },
    adminReviewTaskProjectorRepo: {
      findAmlScreeningReview: vi.fn(),
      createAmlScreeningReview: vi.fn(),
      findSourceOfFundsReview: vi.fn(),
      reactivateSourceOfFundsReview: vi.fn(),
      createSourceOfFundsReview: vi.fn(),
    },
    notificationFanoutReader: {} as never,
    adminImpersonationNotifyReader: {} as never,
    paymentRefundNotifyReader: {} as never,
    payoutTransferFailedNotifyReader: {} as never,
    clearArtistBlocksRepo: {} as never,
    ensurePersonalLegalEntity: { ensure: vi.fn() },
    sourceOfFundsSettlementReader: {} as never,
    sourceOfFundsBuyerReader: {} as never,
    sourceOfFundsDocumentsTaskRepo: {} as never,
    sourceOfFundsDocumentReviewRepo: {} as never,
    sourceOfFundsReviewResolutionRepo: {} as never,
    lotNotifyReader: {} as never,
    log,
    staffOpsRecipientReader: { listRecipients: vi.fn().mockResolvedValue([]) },
    complianceRecipientReader: { listRecipients: vi.fn().mockResolvedValue([]) },
    ...overrides,
  };
}

describe("processAmlMatchReview MLRO escalation", () => {
  it("enqueues exactly one idempotent compliance email per recipient", async () => {
    const eventRow = {
      id: 7,
      eventType: "aml.match_flagged",
      aggregateId: "scr_1",
      payload: {
        screeningId: "scr_1",
        userId: "u1",
        matchStatus: "possible_match",
        categories: "pep",
      },
    };
    const recipient = { id: "mlro_1", email: "mlro@example.com", firstName: "M" };
    const complianceRecipientReader = {
      listRecipients: vi.fn().mockResolvedValue([recipient]),
    };
    const adminReviewTaskProjectorRepo = {
      findAmlScreeningReview: vi.fn().mockResolvedValue(null),
      createAmlScreeningReview: vi.fn().mockResolvedValue(undefined),
      findSourceOfFundsReview: vi.fn(),
      reactivateSourceOfFundsReview: vi.fn(),
      createSourceOfFundsReview: vi.fn(),
    };
    const emailService = makeEmail();
    const ctx = makeCtx({
      domainEventReader: {
        listAfterCursor: vi.fn().mockResolvedValue([eventRow]),
        getById: vi.fn(),
        listLockedForProjector: vi.fn(),
      },
      adminReviewTaskProjectorRepo: adminReviewTaskProjectorRepo as never,
      complianceRecipientReader,
      emailService,
      supportContactEmail: "compliance@example.com",
      webOrigin: "https://app.example.com",
      adminEmailAddress: "ops@example.com",
    });

    await processAmlMatchReview({ ctx, log });

    expect(adminReviewTaskProjectorRepo.createAmlScreeningReview).toHaveBeenCalled();
    expect(emailService.enqueue).toHaveBeenCalledTimes(1);
    expect(emailService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "aml-compliance-review-notice",
        to: "mlro@example.com",
        idempotencyKey: "aml-compliance-review-notice:screening:scr_1:mlro_1",
        vars: expect.objectContaining({ kind: "screening", caseReference: "scr_1" }),
      }),
    );
  });

  it("does not enqueue email when the review task already exists", async () => {
    const eventRow = {
      id: 8,
      eventType: "aml.match_flagged",
      aggregateId: "scr_2",
      payload: { screeningId: "scr_2", userId: "u2", matchStatus: "possible_match" },
    };
    const adminReviewTaskProjectorRepo = {
      findAmlScreeningReview: vi.fn().mockResolvedValue({ id: "task_existing" }),
      createAmlScreeningReview: vi.fn(),
      findSourceOfFundsReview: vi.fn(),
      reactivateSourceOfFundsReview: vi.fn(),
      createSourceOfFundsReview: vi.fn(),
    };
    const emailService = makeEmail();
    const ctx = makeCtx({
      domainEventReader: {
        listAfterCursor: vi.fn().mockResolvedValue([eventRow]),
        getById: vi.fn(),
        listLockedForProjector: vi.fn(),
      },
      adminReviewTaskProjectorRepo: adminReviewTaskProjectorRepo as never,
      complianceRecipientReader: { listRecipients: vi.fn().mockResolvedValue([]) },
      emailService,
      supportContactEmail: "compliance@example.com",
      webOrigin: "https://app.example.com",
    });

    await processAmlMatchReview({ ctx, log });

    expect(adminReviewTaskProjectorRepo.createAmlScreeningReview).not.toHaveBeenCalled();
    expect(emailService.enqueue).not.toHaveBeenCalled();
  });

  it("does not send when there are no flagged events", async () => {
    const emailService = makeEmail();
    const ctx = makeCtx({
      domainEventReader: {
        listAfterCursor: vi.fn().mockResolvedValue([]),
        getById: vi.fn(),
        listLockedForProjector: vi.fn(),
      },
      adminReviewTaskProjectorRepo: {
        findAmlScreeningReview: vi.fn(),
        createAmlScreeningReview: vi.fn(),
        findSourceOfFundsReview: vi.fn(),
        reactivateSourceOfFundsReview: vi.fn(),
        createSourceOfFundsReview: vi.fn(),
      } as never,
      complianceRecipientReader: { listRecipients: vi.fn().mockResolvedValue([]) },
      emailService,
      supportContactEmail: "compliance@example.com",
      webOrigin: "https://app.example.com",
    });

    await processAmlMatchReview({ ctx, log });

    expect(emailService.enqueue).not.toHaveBeenCalled();
  });
});
