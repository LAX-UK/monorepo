import type { IEmailService } from "@auction/email";
import { describe, expect, it, vi } from "vitest";
import type { ProjectorRunContext } from "./lib/projector.types.js";
import { processSourceOfFundsReview } from "./source-of-funds-review.js";

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never;

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
      findSourceOfFundsReview: vi.fn(),
      reactivateSourceOfFundsReview: vi.fn(),
      createSourceOfFundsReview: vi.fn(),
      findAmlScreeningReview: vi.fn(),
      createAmlScreeningReview: vi.fn(),
    },
    notificationFanoutReader: {} as never,
    adminImpersonationNotifyReader: {} as never,
    paymentRefundNotifyReader: {} as never,
    payoutTransferFailedNotifyReader: {} as never,
    clearArtistBlocksRepo: {} as never,
    ensurePersonalLegalEntity: { ensure: vi.fn() },
    sourceOfFundsSettlementReader: {} as never,
    sourceOfFundsBuyerReader: {
      getBuyerContact: vi.fn().mockResolvedValue({ email: "buyer@example.com", firstName: "Bee" }),
    },
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

describe("processSourceOfFundsReview", () => {
  it("reactivates an existing task when the case is reopened", async () => {
    const eventRow = {
      id: 9,
      eventType: "source_of_funds.required",
      aggregateId: "sof_1",
      payload: {
        sourceOfFundsId: "sof_1",
        userId: "u1",
        reopened: true,
      },
    };
    const adminReviewTaskProjectorRepo = {
      findSourceOfFundsReview: vi.fn().mockResolvedValue({ id: "task_1", status: "resolved" }),
      reactivateSourceOfFundsReview: vi.fn().mockResolvedValue(undefined),
      createSourceOfFundsReview: vi.fn(),
      findAmlScreeningReview: vi.fn(),
      createAmlScreeningReview: vi.fn(),
    };
    const emailService = { enqueue: vi.fn() } as unknown as IEmailService;
    const ctx = makeCtx({
      domainEventReader: {
        listAfterCursor: vi.fn().mockResolvedValue([eventRow]),
        getById: vi.fn(),
        listLockedForProjector: vi.fn(),
      },
      adminReviewTaskProjectorRepo: adminReviewTaskProjectorRepo as never,
      emailService,
      supportContactEmail: "compliance@example.com",
      webOrigin: "https://app.example.com",
    });

    await processSourceOfFundsReview({ ctx, log });

    expect(adminReviewTaskProjectorRepo.reactivateSourceOfFundsReview).toHaveBeenCalledWith(
      "task_1",
    );
    expect(emailService.enqueue).not.toHaveBeenCalled();
  });

  it("notifies the buyer when a new SoF case/task is created", async () => {
    const eventRow = {
      id: 12,
      eventType: "source_of_funds.required",
      aggregateId: "sof_2",
      payload: {
        sourceOfFundsId: "sof_2",
        userId: "buyer_1",
        trigger: "threshold",
        exposureAmount: "12000.00",
        currency: "GBP",
      },
    };
    const adminReviewTaskProjectorRepo = {
      findSourceOfFundsReview: vi.fn().mockResolvedValue(null),
      reactivateSourceOfFundsReview: vi.fn(),
      createSourceOfFundsReview: vi.fn().mockResolvedValue(undefined),
      findAmlScreeningReview: vi.fn(),
      createAmlScreeningReview: vi.fn(),
    };
    const emailService = { enqueue: vi.fn() } as unknown as IEmailService;
    const ctx = makeCtx({
      domainEventReader: {
        listAfterCursor: vi.fn().mockResolvedValue([eventRow]),
        getById: vi.fn(),
        listLockedForProjector: vi.fn(),
      },
      adminReviewTaskProjectorRepo: adminReviewTaskProjectorRepo as never,
      emailService,
      supportContactEmail: "compliance@example.com",
      webOrigin: "https://app.example.com",
    });

    await processSourceOfFundsReview({ ctx, log });

    expect(adminReviewTaskProjectorRepo.createSourceOfFundsReview).toHaveBeenCalled();
    expect(emailService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "source-of-funds-buyer-notice",
        to: "buyer@example.com",
        userId: "buyer_1",
        idempotencyKey: "source-of-funds-buyer-notice:sof_2",
      }),
    );
  });
});
