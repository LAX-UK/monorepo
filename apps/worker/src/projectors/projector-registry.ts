import { processAdminImpersonationNotify } from "./admin-impersonation-notify.js";
import { AML_MATCH_REVIEW_PROJECTOR, processAmlMatchReview } from "./aml-match-review.js";
import { ARTWORK_OFFER_LOCK_PROJECTOR, processArtworkOfferLock } from "./artwork-offer-lock.js";
import { BID_ALERT_MATCHING_PROJECTOR, processBidAlertMatching } from "./bid-alert-matching.js";
import {
  BID_IDENTITY_DIRECTORY_PROJECTOR,
  processBidIdentityDirectory,
} from "./bid-identity-directory.js";
import {
  BID_PERSONAL_DATA_ANONYMISATION_PROJECTOR,
  processBidPersonalDataAnonymisation,
} from "./bid-personal-data-anonymisation.js";
import {
  BID_PROFILE_PROVISIONING_PROJECTOR,
  processBidProfileProvisioning,
} from "./bid-profile-provisioning.js";
import { processClearArtistBlocks } from "./clear-artist-blocks.js";
import { processLegalEntityProvisioning } from "./legal-entity-provisioning.js";
import type { Projector, ProjectorRunContext } from "./lib/projector.types.js";
import {
  LOT_INVOICE_INITIATION_PROJECTOR,
  processLotInvoiceInitiation,
} from "./lot-invoice-initiation.js";
import { processLotVoidedAntiShillingAdminNotify } from "./lot-voided-anti-shilling-admin-notify.js";
import { NOTIFICATION_FANOUT_PROJECTOR, processNotificationFanout } from "./notification-fanout.js";
import { processPaymentRefundNotify } from "./payment-refund-notify.js";
import { processPayoutTransferFailedNotify } from "./payout-transfer-failed-notify.js";
import {
  SHOP_IDENTITY_PROJECTION_PROJECTOR,
  processShopIdentityProjection,
} from "./shop-identity-projection.js";
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
import {
  UNSOLD_CHOICE_DEADLINE_PROJECTOR,
  processUnsoldChoiceDeadline,
} from "./unsold-choice-deadline.js";
import { UNSOLD_FOLLOW_UP_PROJECTOR, processUnsoldFollowUp } from "./unsold-follow-up.js";
import { createXeroProjector } from "./xero-projector.js";
import { createZohoArtworkListingProjector } from "./zoho-artwork-listing-projector.js";
import { createZohoArtworkWritebackProjector } from "./zoho-artwork-writeback-projector.js";
import {
  ZOHO_CAMPAIGNS_OPT_OUT_LIFT_PROJECTOR,
  processZohoCampaignsOptOutLift,
} from "./zoho-campaigns-opt-out-lift.js";
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
    ctx,
    log: ctx.log,
    emailService: ctx.emailService as NonNullable<ProjectorRunContext["emailService"]>,
    supportContactEmail: ctx.supportContactEmail as string,
  };
}

export function createDefaultProjectorRegistry(): ProjectorRegistry {
  const projectors: Projector[] = [
    createXeroProjector(),
    createZohoProjector(),
    {
      name: SHOP_IDENTITY_PROJECTION_PROJECTOR,
      isEnabled(ctx) {
        return ctx.shopIdentityProjection != null;
      },
      async run(ctx) {
        await processShopIdentityProjection(ctx);
      },
    },
    {
      name: "admin_impersonation_notify",
      isEnabled(ctx) {
        return Boolean(ctx.emailService && ctx.supportContactEmail);
      },
      async run(ctx) {
        await ctx.projectorStateRepo.ensureCursor("admin_impersonation_notify");
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
        await ctx.projectorStateRepo.ensureCursor("payout_transfer_failed_notify");
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
        await ctx.projectorStateRepo.ensureCursor(NOTIFICATION_FANOUT_PROJECTOR);
        await processNotificationFanout({
          ...emailProjectorArgs(ctx),
          adminPayoutsUrl: ctx.adminPayoutsUrl as string,
        });
      },
    },
    {
      name: "payment_refund_notify",
      isEnabled(ctx) {
        return Boolean(ctx.emailService && ctx.supportContactEmail);
      },
      async run(ctx) {
        await ctx.projectorStateRepo.ensureCursor("payment_refund_notify");
        await processPaymentRefundNotify({
          ...emailProjectorArgs(ctx),
        });
      },
    },
    {
      name: "lot_voided_anti_shilling_admin_notify",
      isEnabled(ctx) {
        return Boolean(ctx.emailService && ctx.supportContactEmail && ctx.webOrigin);
      },
      async run(ctx) {
        await ctx.projectorStateRepo.ensureCursor("lot_voided_anti_shilling_admin_notify");
        await processLotVoidedAntiShillingAdminNotify({
          ...emailProjectorArgs(ctx),
          webOrigin: ctx.webOrigin as string,
        });
      },
    },
    {
      name: "clear_artist_blocks",
      async run(ctx) {
        await ctx.projectorStateRepo.ensureCursor("clear_artist_blocks");
        await processClearArtistBlocks({ ctx, log: ctx.log });
      },
    },
    {
      name: "legal_entity_provisioning",
      async run(ctx) {
        await processLegalEntityProvisioning({ ctx, log: ctx.log });
      },
    },
    {
      name: BID_IDENTITY_DIRECTORY_PROJECTOR,
      async run(ctx) {
        await processBidIdentityDirectory(ctx);
      },
    },
    {
      name: BID_PERSONAL_DATA_ANONYMISATION_PROJECTOR,
      async run(ctx) {
        await processBidPersonalDataAnonymisation(ctx);
      },
    },
    {
      name: BID_PROFILE_PROVISIONING_PROJECTOR,
      async run(ctx) {
        await processBidProfileProvisioning({ ctx, log: ctx.log });
      },
    },
    {
      name: AML_MATCH_REVIEW_PROJECTOR,
      async run(ctx) {
        await ctx.projectorStateRepo.ensureCursor(AML_MATCH_REVIEW_PROJECTOR);
        await processAmlMatchReview({ ctx, log: ctx.log });
      },
    },
    {
      name: SOURCE_OF_FUNDS_REVIEW_PROJECTOR,
      async run(ctx) {
        await ctx.projectorStateRepo.ensureCursor(SOURCE_OF_FUNDS_REVIEW_PROJECTOR);
        await processSourceOfFundsReview({ ctx, log: ctx.log });
      },
    },
    {
      name: SOURCE_OF_FUNDS_REVIEW_RESOLUTION_PROJECTOR,
      async run(ctx) {
        await ctx.projectorStateRepo.ensureCursor(SOURCE_OF_FUNDS_REVIEW_RESOLUTION_PROJECTOR);
        await processSourceOfFundsReviewResolution({ ctx, log: ctx.log });
      },
    },
    {
      name: SOURCE_OF_FUNDS_DOCUMENTS_PROJECTOR,
      async run(ctx) {
        await ctx.projectorStateRepo.ensureCursor(SOURCE_OF_FUNDS_DOCUMENTS_PROJECTOR);
        await processSourceOfFundsDocuments({ ctx, log: ctx.log });
      },
    },
    {
      name: SOURCE_OF_FUNDS_DOCUMENT_REVIEW_PROJECTOR,
      async run(ctx) {
        await ctx.projectorStateRepo.ensureCursor(SOURCE_OF_FUNDS_DOCUMENT_REVIEW_PROJECTOR);
        await processSourceOfFundsDocumentReview({ ctx, log: ctx.log });
      },
    },
    {
      name: LOT_INVOICE_INITIATION_PROJECTOR,
      isEnabled(ctx) {
        return ctx.ensureLotInvoice != null;
      },
      async run(ctx) {
        await ctx.projectorStateRepo.ensureCursor(LOT_INVOICE_INITIATION_PROJECTOR);
        await processLotInvoiceInitiation({
          ctx,
          log: ctx.log,
          ensureLotInvoice: ctx.ensureLotInvoice as NonNullable<
            ProjectorRunContext["ensureLotInvoice"]
          >,
        });
      },
    },
    {
      name: UNSOLD_CHOICE_DEADLINE_PROJECTOR,
      isEnabled(ctx) {
        return ctx.unsoldChoiceDeadlines != null;
      },
      async run(ctx) {
        await ctx.projectorStateRepo.ensureCursor(UNSOLD_CHOICE_DEADLINE_PROJECTOR);
        await processUnsoldChoiceDeadline({
          ctx,
          log: ctx.log,
          recorder: ctx.unsoldChoiceDeadlines as NonNullable<
            ProjectorRunContext["unsoldChoiceDeadlines"]
          >,
        });
      },
    },
    {
      name: UNSOLD_FOLLOW_UP_PROJECTOR,
      isEnabled(ctx) {
        return ctx.unsoldFollowUps != null;
      },
      async run(ctx) {
        await ctx.projectorStateRepo.ensureCursor(UNSOLD_FOLLOW_UP_PROJECTOR);
        await processUnsoldFollowUp({
          ctx,
          log: ctx.log,
          opener: ctx.unsoldFollowUps as NonNullable<ProjectorRunContext["unsoldFollowUps"]>,
        });
      },
    },
    {
      name: BID_ALERT_MATCHING_PROJECTOR,
      isEnabled(ctx) {
        return ctx.bidAlerts != null;
      },
      async run(ctx) {
        await ctx.projectorStateRepo.ensureCursor(BID_ALERT_MATCHING_PROJECTOR);
        await processBidAlertMatching({
          ctx,
          log: ctx.log,
          matching: ctx.bidAlerts as NonNullable<ProjectorRunContext["bidAlerts"]>,
        });
      },
    },
    {
      name: ARTWORK_OFFER_LOCK_PROJECTOR,
      isEnabled(ctx) {
        return ctx.artworkOfferLock != null;
      },
      async run(ctx) {
        await ctx.projectorStateRepo.ensureCursor(ARTWORK_OFFER_LOCK_PROJECTOR);
        await processArtworkOfferLock({
          ctx,
          log: ctx.log,
          recorder: ctx.artworkOfferLock as NonNullable<ProjectorRunContext["artworkOfferLock"]>,
        });
      },
    },
    createZohoArtworkWritebackProjector(),
    createZohoArtworkListingProjector(),
    {
      name: ZOHO_CAMPAIGNS_OPT_OUT_LIFT_PROJECTOR,
      async run(ctx) {
        await ctx.projectorStateRepo.ensureCursor(ZOHO_CAMPAIGNS_OPT_OUT_LIFT_PROJECTOR);
        await processZohoCampaignsOptOutLift({ ctx, log: ctx.log });
      },
    },
  ];

  return new ProjectorRegistry(projectors);
}
