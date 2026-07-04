import { processAdminImpersonationNotify } from "./admin-impersonation-notify.js";
import { AML_MATCH_REVIEW_PROJECTOR, processAmlMatchReview } from "./aml-match-review.js";
import { processClearArtistBlocks } from "./clear-artist-blocks.js";
import { processLegalEntityProvisioning } from "./legal-entity-provisioning.js";
import type { ProjectorStateRepository } from "./lib/projector-state.repository.js";
import type { Projector, ProjectorRunContext } from "./lib/projector.types.js";
import {
  LOT_INVOICE_INITIATION_PROJECTOR,
  processLotInvoiceInitiation,
} from "./lot-invoice-initiation.js";
import { processLotVoidedAntiShillingAdminNotify } from "./lot-voided-anti-shilling-admin-notify.js";
import { createMarketingContactsProjector } from "./marketing-contacts-projector.js";
import { NOTIFICATION_FANOUT_PROJECTOR, processNotificationFanout } from "./notification-fanout.js";
import { processPaymentRefundNotify } from "./payment-refund-notify.js";
import { processPayoutTransferFailedNotify } from "./payout-transfer-failed-notify.js";
import {
  SOURCE_OF_FUNDS_DOCUMENT_REVIEW_PROJECTOR,
  processSourceOfFundsDocumentReview,
} from "./source-of-funds-document-review.js";
import {
  SOURCE_OF_FUNDS_DOCUMENTS_PROJECTOR,
  processSourceOfFundsDocuments,
} from "./source-of-funds-documents.js";
import {
  SOURCE_OF_FUNDS_REVIEW_RESOLUTION_PROJECTOR,
  processSourceOfFundsReviewResolution,
} from "./source-of-funds-review-resolution.js";
import {
  SOURCE_OF_FUNDS_REVIEW_PROJECTOR,
  processSourceOfFundsReview,
} from "./source-of-funds-review.js";
import { createXeroProjector } from "./xero-projector.js";
import { createZohoProjector } from "./zoho-projector.js";

export class ProjectorRegistry {
  constructor(private readonly projectors: readonly Projector[]) {}

  async runAll(ctx: ProjectorRunContext): Promise<void> {
    for (const projector of this.projectors) {
      if (projector.isEnabled && !projector.isEnabled(ctx)) {
        continue;
      }
      await projector.run(ctx);
    }
  }

  listProjectorNames(): string[] {
    return this.projectors.map((projector) => projector.name);
  }

  listEnabledProjectorNames(ctx: ProjectorRunContext): string[] {
    return this.projectors
      .filter((projector) => !projector.isEnabled || projector.isEnabled(ctx))
      .map((projector) => projector.name);
  }
}

function emailProjectorArgs(ctx: ProjectorRunContext) {
  return {
    db: ctx.db,
    log: ctx.log,
    emailService: ctx.emailService as NonNullable<ProjectorRunContext["emailService"]>,
    supportContactEmail: ctx.supportContactEmail as string,
  };
}

export function createDefaultProjectorRegistry(
  stateRepo: ProjectorStateRepository,
): ProjectorRegistry {
  const projectors: Projector[] = [
    createZohoProjector(stateRepo),
    createXeroProjector(stateRepo),
    createMarketingContactsProjector(stateRepo),
    {
      name: "admin_impersonation_notify",
      isEnabled(ctx) {
        return Boolean(ctx.emailService && ctx.supportContactEmail);
      },
      async run(ctx) {
        await stateRepo.ensureCursor("admin_impersonation_notify");
        await processAdminImpersonationNotify({
          ...emailProjectorArgs(ctx),
        });
      },
    },
    {
      name: "payout_transfer_failed_notify",
      isEnabled(ctx) {
        return Boolean(ctx.emailService && ctx.supportContactEmail && ctx.adminPayoutsUrl);
      },
      async run(ctx) {
        await stateRepo.ensureCursor("payout_transfer_failed_notify");
        await processPayoutTransferFailedNotify({
          ...emailProjectorArgs(ctx),
          adminPayoutsUrl: ctx.adminPayoutsUrl as string,
        });
      },
    },
    {
      name: NOTIFICATION_FANOUT_PROJECTOR,
      isEnabled(ctx) {
        return Boolean(ctx.emailService && ctx.supportContactEmail && ctx.adminPayoutsUrl);
      },
      async run(ctx) {
        await stateRepo.ensureCursor(NOTIFICATION_FANOUT_PROJECTOR);
        await processNotificationFanout({
          ...emailProjectorArgs(ctx),
          adminPayoutsUrl: ctx.adminPayoutsUrl as string,
          staffOpsRecipientReader: ctx.staffOpsRecipientReader,
          adminEmailAddress: ctx.adminEmailAddress,
          webOrigin: ctx.webOrigin,
        });
      },
    },
    {
      name: "payment_refund_notify",
      isEnabled(ctx) {
        return Boolean(ctx.emailService && ctx.supportContactEmail);
      },
      async run(ctx) {
        await stateRepo.ensureCursor("payment_refund_notify");
        await processPaymentRefundNotify({
          ...emailProjectorArgs(ctx),
          staffOpsRecipientReader: ctx.staffOpsRecipientReader,
          adminEmailAddress: ctx.adminEmailAddress,
        });
      },
    },
    {
      name: "lot_voided_anti_shilling_admin_notify",
      isEnabled(ctx) {
        return Boolean(ctx.emailService && ctx.supportContactEmail && ctx.webOrigin);
      },
      async run(ctx) {
        await stateRepo.ensureCursor("lot_voided_anti_shilling_admin_notify");
        await processLotVoidedAntiShillingAdminNotify({
          ...emailProjectorArgs(ctx),
          staffOpsRecipientReader: ctx.staffOpsRecipientReader,
          adminEmailAddress: ctx.adminEmailAddress,
          webOrigin: ctx.webOrigin as string,
        });
      },
    },
    {
      name: "clear_artist_blocks",
      async run(ctx) {
        await stateRepo.ensureCursor("clear_artist_blocks");
        await processClearArtistBlocks({ db: ctx.db, log: ctx.log });
      },
    },
    {
      name: "legal_entity_provisioning",
      async run(ctx) {
        await processLegalEntityProvisioning({ db: ctx.db, log: ctx.log });
      },
    },
    {
      name: AML_MATCH_REVIEW_PROJECTOR,
      async run(ctx) {
        await stateRepo.ensureCursor(AML_MATCH_REVIEW_PROJECTOR);
        await processAmlMatchReview({
          db: ctx.db,
          log: ctx.log,
          complianceRecipientReader: ctx.complianceRecipientReader,
          emailService: ctx.emailService,
          supportContactEmail: ctx.supportContactEmail,
          webOrigin: ctx.webOrigin,
          adminEmailAddress: ctx.adminEmailAddress,
        });
      },
    },
    {
      name: SOURCE_OF_FUNDS_REVIEW_PROJECTOR,
      async run(ctx) {
        await stateRepo.ensureCursor(SOURCE_OF_FUNDS_REVIEW_PROJECTOR);
        await processSourceOfFundsReview({
          db: ctx.db,
          log: ctx.log,
          complianceRecipientReader: ctx.complianceRecipientReader,
          emailService: ctx.emailService,
          supportContactEmail: ctx.supportContactEmail,
          webOrigin: ctx.webOrigin,
          adminEmailAddress: ctx.adminEmailAddress,
        });
      },
    },
    {
      name: SOURCE_OF_FUNDS_REVIEW_RESOLUTION_PROJECTOR,
      async run(ctx) {
        await stateRepo.ensureCursor(SOURCE_OF_FUNDS_REVIEW_RESOLUTION_PROJECTOR);
        await processSourceOfFundsReviewResolution({
          db: ctx.db,
          log: ctx.log,
        });
      },
    },
    {
      name: SOURCE_OF_FUNDS_DOCUMENTS_PROJECTOR,
      async run(ctx) {
        await stateRepo.ensureCursor(SOURCE_OF_FUNDS_DOCUMENTS_PROJECTOR);
        await processSourceOfFundsDocuments({
          db: ctx.db,
          log: ctx.log,
          complianceRecipientReader: ctx.complianceRecipientReader,
          emailService: ctx.emailService,
          supportContactEmail: ctx.supportContactEmail,
          webOrigin: ctx.webOrigin,
          adminEmailAddress: ctx.adminEmailAddress,
        });
      },
    },
    {
      name: SOURCE_OF_FUNDS_DOCUMENT_REVIEW_PROJECTOR,
      async run(ctx) {
        await stateRepo.ensureCursor(SOURCE_OF_FUNDS_DOCUMENT_REVIEW_PROJECTOR);
        await processSourceOfFundsDocumentReview({
          db: ctx.db,
          log: ctx.log,
        });
      },
    },
    {
      name: LOT_INVOICE_INITIATION_PROJECTOR,
      isEnabled(ctx) {
        return ctx.ensureLotInvoice != null;
      },
      async run(ctx) {
        await stateRepo.ensureCursor(LOT_INVOICE_INITIATION_PROJECTOR);
        await processLotInvoiceInitiation({
          db: ctx.db,
          log: ctx.log,
          ensureLotInvoice: ctx.ensureLotInvoice as NonNullable<
            ProjectorRunContext["ensureLotInvoice"]
          >,
        });
      },
    },
  ];

  return new ProjectorRegistry(projectors);
}
