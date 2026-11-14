import type { IEmailService } from "@auction/email";
import { describe, expect, it, vi } from "vitest";
import { ACCOUNTING_PROJECTOR } from "./accounting-projector.js";
import { ACCOUNTING_SENDER } from "./accounting-sender.js";
import { AML_MATCH_REVIEW_PROJECTOR } from "./aml-match-review.js";
import { ARTWORK_OFFER_LOCK_PROJECTOR } from "./artwork-offer-lock.js";
import { BID_ALERT_MATCHING_PROJECTOR } from "./bid-alert-matching.js";
import { BID_IDENTITY_DIRECTORY_PROJECTOR } from "./bid-identity-directory.js";
import { BID_PERSONAL_DATA_ANONYMISATION_PROJECTOR } from "./bid-personal-data-anonymisation.js";
import { COLLECTION_BOOKING_NOTIFY_PROJECTOR } from "./collection-booking-notify.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";
import { LOT_INVOICE_INITIATION_PROJECTOR } from "./lot-invoice-initiation.js";
import { NOTIFICATION_FANOUT_PROJECTOR } from "./notification-fanout.js";
import { createDefaultProjectorRegistry } from "./projector-registry.js";
import { SOURCE_OF_FUNDS_DOCUMENT_REVIEW_PROJECTOR } from "./source-of-funds-document-review.js";
import { SOURCE_OF_FUNDS_DOCUMENTS_PROJECTOR } from "./source-of-funds-documents.js";
import { SOURCE_OF_FUNDS_REVIEW_RESOLUTION_PROJECTOR } from "./source-of-funds-review-resolution.js";
import { SOURCE_OF_FUNDS_REVIEW_PROJECTOR } from "./source-of-funds-review.js";
import { UNSOLD_CHOICE_DEADLINE_PROJECTOR } from "./unsold-choice-deadline.js";
import { UNSOLD_FOLLOW_UP_PROJECTOR } from "./unsold-follow-up.js";
import { WEB_PUBLIC_CACHE_PROJECTOR } from "./web-public-cache.js";
import { XERO_PROJECTOR } from "./xero-projector.js";
import { ZOHO_ARTWORK_LISTING_PROJECTOR } from "./zoho-artwork-listing-projector.js";
import { ZOHO_ARTWORK_WRITEBACK_PROJECTOR } from "./zoho-artwork-writeback-projector.js";
import { ZOHO_CAMPAIGNS_OPT_OUT_LIFT_PROJECTOR } from "./zoho-campaigns-opt-out-lift.js";
import { ZOHO_FULFILMENT_PROJECTOR } from "./zoho-fulfilment-projector.js";
import { ZOHO_PROJECTOR } from "./zoho-projector.js";

/** Pin tick order and projector names from the pre-registry runner. */
const EXPECTED_PROJECTOR_ORDER = [
  XERO_PROJECTOR,
  ZOHO_PROJECTOR,
  "shop_identity_projection",
  "admin_impersonation_notify",
  "payout_transfer_failed_notify",
  NOTIFICATION_FANOUT_PROJECTOR,
  "payment_refund_notify",
  "lot_voided_anti_shilling_admin_notify",
  "clear_artist_blocks",
  "legal_entity_provisioning",
  BID_IDENTITY_DIRECTORY_PROJECTOR,
  BID_PERSONAL_DATA_ANONYMISATION_PROJECTOR,
  "bid_profile_provisioning",
  AML_MATCH_REVIEW_PROJECTOR,
  SOURCE_OF_FUNDS_REVIEW_PROJECTOR,
  SOURCE_OF_FUNDS_REVIEW_RESOLUTION_PROJECTOR,
  SOURCE_OF_FUNDS_DOCUMENTS_PROJECTOR,
  SOURCE_OF_FUNDS_DOCUMENT_REVIEW_PROJECTOR,
  LOT_INVOICE_INITIATION_PROJECTOR,
  UNSOLD_CHOICE_DEADLINE_PROJECTOR,
  UNSOLD_FOLLOW_UP_PROJECTOR,
  BID_ALERT_MATCHING_PROJECTOR,
  ARTWORK_OFFER_LOCK_PROJECTOR,
  ZOHO_ARTWORK_WRITEBACK_PROJECTOR,
  ZOHO_ARTWORK_LISTING_PROJECTOR,
  ZOHO_FULFILMENT_PROJECTOR,
  ZOHO_CAMPAIGNS_OPT_OUT_LIFT_PROJECTOR,
  COLLECTION_BOOKING_NOTIFY_PROJECTOR,
  ACCOUNTING_PROJECTOR,
  ACCOUNTING_SENDER,
  WEB_PUBLIC_CACHE_PROJECTOR,
] as const;

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
      getById: vi.fn(),
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
      getSaleTitle: vi.fn(),
      getUserForProxyNotice: vi.fn(),
      getWinnerContact: vi.fn(),
      getManualReviewContext: vi.fn(),
      listSaleCancelledPeople: vi.fn(),
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
    zohoCampaignsOptOutLiftRepo: { liftOptOut: vi.fn() },
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

  it("runs the alert matcher only while alerts are on", () => {
    expect(registry.listEnabledProjectorNames(baseCtx())).not.toContain(
      BID_ALERT_MATCHING_PROJECTOR,
    );
    const on = registry.listEnabledProjectorNames(
      baseCtx({
        bidAlerts: {
          isSeeded: async () => true,
          handle: async () => undefined,
          lotStart: async () => 0,
          handleLots: async () => undefined,
        },
      }),
    );
    expect(on).toContain(BID_ALERT_MATCHING_PROJECTOR);
  });

  it("runs the Zoho artwork writeback only while its mode is not off", () => {
    expect(registry.listEnabledProjectorNames(baseCtx())).not.toContain(
      ZOHO_ARTWORK_WRITEBACK_PROJECTOR,
    );
    const on = registry.listEnabledProjectorNames(
      baseCtx({
        zohoArtworkWriteback: {
          deliver: async () => ({ outcome: "skipped", reason: "x" }),
        } as never,
      }),
    );
    expect(on).toContain(ZOHO_ARTWORK_WRITEBACK_PROJECTOR);
  });

  it("runs the LAX listing on Zoho only while its mode is not off", () => {
    expect(registry.listEnabledProjectorNames(baseCtx())).not.toContain(
      ZOHO_ARTWORK_LISTING_PROJECTOR,
    );
    const on = registry.listEnabledProjectorNames(
      baseCtx({
        zohoArtworkListing: {
          deliver: async () => ({ outcome: "skipped", reason: "x" }),
        } as never,
      }),
    );
    expect(on).toContain(ZOHO_ARTWORK_LISTING_PROJECTOR);
  });

  it("runs the fulfilment mirror only while its mode is not off", () => {
    expect(registry.listEnabledProjectorNames(baseCtx())).not.toContain(ZOHO_FULFILMENT_PROJECTOR);
    const on = registry.listEnabledProjectorNames(
      baseCtx({
        zohoFulfilment: {
          deliver: async () => ({ outcome: "skipped", reason: "x" }),
        } as never,
      }),
    );
    expect(on).toContain(ZOHO_FULFILMENT_PROJECTOR);
  });

  it("runs the accounting projector and sender only while Books is configured", () => {
    const off = registry.listEnabledProjectorNames(baseCtx());
    expect(off).not.toContain(ACCOUNTING_PROJECTOR);
    expect(off).not.toContain(ACCOUNTING_SENDER);
    const on = registry.listEnabledProjectorNames(baseCtx({ accounting: {} as never }));
    expect(on).toContain(ACCOUNTING_PROJECTOR);
    expect(on).toContain(ACCOUNTING_SENDER);
  });

  it("drops cached public pages only while the web revalidate settings are present", () => {
    expect(registry.listEnabledProjectorNames(baseCtx())).not.toContain(WEB_PUBLIC_CACHE_PROJECTOR);
    const on = registry.listEnabledProjectorNames(baseCtx({ webPublicCache: {} as never }));
    expect(on).toContain(WEB_PUBLIC_CACHE_PROJECTOR);
  });

  it("skips email projectors when emailService or supportContactEmail is missing", () => {
    const enabled = registry.listEnabledProjectorNames(baseCtx());
    expect(enabled).not.toContain("admin_impersonation_notify");
    expect(enabled).not.toContain("payout_transfer_failed_notify");
    expect(enabled).not.toContain(NOTIFICATION_FANOUT_PROJECTOR);
    expect(enabled).not.toContain("payment_refund_notify");
    expect(enabled).not.toContain("lot_voided_anti_shilling_admin_notify");
    expect(enabled).toContain(XERO_PROJECTOR);
    expect(enabled).not.toContain(ZOHO_PROJECTOR);
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
