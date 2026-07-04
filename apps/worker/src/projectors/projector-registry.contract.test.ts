import type { IEmailService } from "@auction/email";
import { describe, expect, it, vi } from "vitest";
import {
  type AssertAssignable,
  defineCompileTimeContract,
} from "../testing/compile-time-contract.js";
import { AML_MATCH_REVIEW_PROJECTOR } from "./aml-match-review.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";
import { LOT_INVOICE_INITIATION_PROJECTOR } from "./lot-invoice-initiation.js";
import { MARKETING_CONTACTS_PROJECTOR } from "./marketing-contacts-projector.js";
import { NOTIFICATION_FANOUT_PROJECTOR } from "./notification-fanout.js";
import { type ProjectorRegistry, createDefaultProjectorRegistry } from "./projector-registry.js";
import { SOURCE_OF_FUNDS_DOCUMENT_REVIEW_PROJECTOR } from "./source-of-funds-document-review.js";
import { SOURCE_OF_FUNDS_DOCUMENTS_PROJECTOR } from "./source-of-funds-documents.js";
import { SOURCE_OF_FUNDS_REVIEW_RESOLUTION_PROJECTOR } from "./source-of-funds-review-resolution.js";
import { SOURCE_OF_FUNDS_REVIEW_PROJECTOR } from "./source-of-funds-review.js";
import { XERO_PROJECTOR } from "./xero-projector.js";
import { ZOHO_PROJECTOR } from "./zoho-projector.js";

/** Pin tick order and projector names from the pre-registry runner. */
const EXPECTED_PROJECTOR_ORDER = [
  ZOHO_PROJECTOR,
  XERO_PROJECTOR,
  MARKETING_CONTACTS_PROJECTOR,
  "admin_impersonation_notify",
  "payout_transfer_failed_notify",
  NOTIFICATION_FANOUT_PROJECTOR,
  "payment_refund_notify",
  "lot_voided_anti_shilling_admin_notify",
  "clear_artist_blocks",
  "legal_entity_provisioning",
  AML_MATCH_REVIEW_PROJECTOR,
  SOURCE_OF_FUNDS_REVIEW_PROJECTOR,
  SOURCE_OF_FUNDS_REVIEW_RESOLUTION_PROJECTOR,
  SOURCE_OF_FUNDS_DOCUMENTS_PROJECTOR,
  SOURCE_OF_FUNDS_DOCUMENT_REVIEW_PROJECTOR,
  LOT_INVOICE_INITIATION_PROJECTOR,
] as const;

type _RegistryContract = AssertAssignable<
  ReturnType<typeof createDefaultProjectorRegistry>,
  ProjectorRegistry
>;
defineCompileTimeContract<_RegistryContract>();

function baseCtx(overrides: Partial<ProjectorRunContext> = {}): ProjectorRunContext {
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
      listLockedForProjector: vi.fn().mockResolvedValue([]),
    },
    projectorFailureRecorder: { record: vi.fn() },
    transactionRunner: { runInTransaction: vi.fn(async (fn) => fn({} as never)) },
    notificationWriteRepo: { createMany: vi.fn().mockResolvedValue([]) },
    adminReviewTaskProjectorRepo: {
      findAmlScreeningReview: vi.fn(),
      createAmlScreeningReview: vi.fn(),
      findSourceOfFundsReview: vi.fn(),
      reactivateSourceOfFundsReview: vi.fn(),
      createSourceOfFundsReview: vi.fn(),
    },
    notificationFanoutReader: {
      listEntityRecipients: vi.fn().mockResolvedValue([]),
      getEntityDisplayName: vi.fn().mockResolvedValue("Org"),
      getPayoutAmounts: vi.fn(),
      getLotForVoided: vi.fn(),
      getLotTitle: vi.fn(),
      getUserForProxyNotice: vi.fn(),
      getWinnerContact: vi.fn(),
      getManualReviewContext: vi.fn(),
    },
    adminImpersonationNotifyReader: {
      getAdminDisplayName: vi.fn(),
      listEntityOwnerAdmins: vi.fn().mockResolvedValue([]),
    },
    paymentRefundNotifyReader: { getRefundContext: vi.fn() },
    payoutTransferFailedNotifyReader: { getTransferFailedContext: vi.fn() },
    clearArtistBlocksRepo: {
      getArtistStatus: vi.fn(),
      clearLotsArtistReviewRequired: vi.fn(),
    },
    ensurePersonalLegalEntity: { ensure: vi.fn() },
    sourceOfFundsSettlementReader: {
      loadSettlementContext: vi.fn(),
      getCaseStatus: vi.fn(),
    },
    sourceOfFundsBuyerReader: { getBuyerContact: vi.fn() },
    sourceOfFundsDocumentsTaskRepo: { reopenResolvedReviewTask: vi.fn() },
    sourceOfFundsDocumentReviewRepo: { upsertReview: vi.fn() },
    sourceOfFundsReviewResolutionRepo: { resolveIfTerminal: vi.fn() },
    lotNotifyReader: { getLotTitle: vi.fn() },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as ProjectorRunContext["log"],
    staffOpsRecipientReader: { listRecipients: vi.fn().mockResolvedValue([]) },
    complianceRecipientReader: { listRecipients: vi.fn().mockResolvedValue([]) },
    ...overrides,
  };
}

describe("createDefaultProjectorRegistry", () => {
  const registry = createDefaultProjectorRegistry();

  it("registers projectors in the legacy tick order", () => {
    expect(registry.listProjectorNames()).toEqual([...EXPECTED_PROJECTOR_ORDER]);
  });

  it("skips email projectors when emailService or supportContactEmail is missing", () => {
    const enabled = registry.listEnabledProjectorNames(baseCtx());
    expect(enabled).not.toContain("admin_impersonation_notify");
    expect(enabled).not.toContain("payout_transfer_failed_notify");
    expect(enabled).not.toContain(NOTIFICATION_FANOUT_PROJECTOR);
    expect(enabled).not.toContain("payment_refund_notify");
    expect(enabled).not.toContain("lot_voided_anti_shilling_admin_notify");
    expect(enabled).toContain(ZOHO_PROJECTOR);
    expect(enabled).toContain(XERO_PROJECTOR);
  });

  it("requires adminPayoutsUrl for payout and notification fanout projectors", () => {
    const emailService = {} as IEmailService;
    const withEmailOnly = registry.listEnabledProjectorNames(
      baseCtx({ emailService, supportContactEmail: "ops@example.com" }),
    );
    expect(withEmailOnly).not.toContain("payout_transfer_failed_notify");
    expect(withEmailOnly).not.toContain(NOTIFICATION_FANOUT_PROJECTOR);

    const withPayoutsUrl = registry.listEnabledProjectorNames(
      baseCtx({
        emailService,
        supportContactEmail: "ops@example.com",
        adminPayoutsUrl: "https://app.example.com/admin/payouts",
      }),
    );
    expect(withPayoutsUrl).toContain("payout_transfer_failed_notify");
    expect(withPayoutsUrl).toContain(NOTIFICATION_FANOUT_PROJECTOR);
  });

  it("requires webOrigin for lot voided anti-shilling notify", () => {
    const emailService = {} as IEmailService;
    const withoutOrigin = registry.listEnabledProjectorNames(
      baseCtx({
        emailService,
        supportContactEmail: "ops@example.com",
      }),
    );
    expect(withoutOrigin).not.toContain("lot_voided_anti_shilling_admin_notify");

    const withOrigin = registry.listEnabledProjectorNames(
      baseCtx({
        emailService,
        supportContactEmail: "ops@example.com",
        webOrigin: "https://app.example.com",
      }),
    );
    expect(withOrigin).toContain("lot_voided_anti_shilling_admin_notify");
  });

  it("skips marketing contacts when enqueueMarketingContactSync is unset", () => {
    expect(registry.listEnabledProjectorNames(baseCtx())).not.toContain(
      MARKETING_CONTACTS_PROJECTOR,
    );
    expect(
      registry.listEnabledProjectorNames(
        baseCtx({
          enqueueMarketingContactSync: vi.fn(),
        }),
      ),
    ).toContain(MARKETING_CONTACTS_PROJECTOR);
  });

  it("skips lot invoice initiation when ensureLotInvoice is unset", () => {
    expect(registry.listEnabledProjectorNames(baseCtx())).not.toContain(
      LOT_INVOICE_INITIATION_PROJECTOR,
    );
    expect(
      registry.listEnabledProjectorNames(
        baseCtx({
          ensureLotInvoice: vi.fn(),
        }),
      ),
    ).toContain(LOT_INVOICE_INITIATION_PROJECTOR);
  });
});
