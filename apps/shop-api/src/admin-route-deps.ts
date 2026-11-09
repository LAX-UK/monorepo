import type { OriginalMoveService } from "./application/admin/original-move.service.js";
import type { ReleaseAlertSummaryReader } from "./application/alerts/alert-ports.js";
import type { ArtistApplicationReviewService } from "./application/artist-applications/artist-application-review.service.js";
import type { ArtworkRegisterReviewService } from "./application/artwork-register/artwork-register-review.service.js";
import type { OfferOnLaxArtService } from "./application/artwork-register/offer-on-lax-art.service.js";
import type { ZohoLinkService } from "./application/artwork-register/zoho-link.service.js";
import type { DeliveryRegionsService } from "./application/delivery-regions/delivery-regions.service.js";
import type { EditionRunServices } from "./application/edition-runs/edition-run-services.js";
import type { EnquiryInboxService } from "./application/enquiry-inbox.service.js";
import type { EditionFramingService } from "./application/framing/edition-framing.service.js";
import type { FramingService } from "./application/framing/framing.service.js";
import type { GuestErasureService } from "./application/guest-erasure/guest-erasure.service.js";
import type { ShopMediaUploadHandlers } from "./application/handlers/shop-media-upload.handler.js";
import type { HomeFeaturesService } from "./application/home-features/home-features.service.js";
import type { LeadsService } from "./application/leads/leads.service.js";
import type { AdminReadPorts } from "./application/ports/admin-readers.js";
import type { ArtCacheInvalidator } from "./application/ports/art-cache-invalidator.js";
import type { ArtistSeoWriter } from "./application/ports/artist-seo.writer.js";
import type {
  ArtistCatalogueWriter,
  ArtworkCatalogueWriter,
} from "./application/ports/artwork-catalogue-admin.js";
import type {
  ArtworkImportWriter,
  ImportArtworkCommand,
} from "./application/ports/artwork-import.writer.js";
import type { MerchandiseCatalogueWriter } from "./application/ports/merchandise-catalogue.writer.js";
import type {
  CreateOriginalSaleCommand,
  OriginalSaleWriter,
} from "./application/ports/original-sale.writer.js";
import type { PrintPartyStore } from "./application/ports/print-party.store.js";
import type {
  GrantSaleAuthorityCommand,
  SaleAuthorityWriter,
} from "./application/ports/sale-authority.writer.js";
import type { ApproveSaleFeeCommand, SaleFeeWriter } from "./application/ports/sale-fee.writer.js";
import type { ShopFeatureFlagsReader } from "./application/ports/shop-feature-flags.js";
import type { ShopStaffMemberReader } from "./application/ports/staff-member.reader.js";
import type {
  ReleaseStockHoldCommand,
  StockHoldWriter,
} from "./application/ports/stock-hold.writer.js";
import type {
  RecordThirdPartySaleCommand,
  ThirdPartySaleWriter,
} from "./application/ports/third-party-sale.writer.js";
import type { PrintFulfilmentServices } from "./application/print-fulfilment/print-fulfilment-services.js";
import type { ProductionTaskService } from "./application/production-task.service.js";
import type { SavedViewService } from "./application/saved-view.service.js";
import type { createAdjustMerchandiseStockHandler } from "./infrastructure/handlers/admin/adjust-merchandise-stock.handler.js";
import type { createAdvanceReturnHandler } from "./infrastructure/handlers/admin/advance-return.handler.js";
import type { createCancelAfterPossessionHandler } from "./infrastructure/handlers/admin/cancel-after-possession.handler.js";
import type { createCreateMerchandiseProductHandler } from "./infrastructure/handlers/admin/create-merchandise-product.handler.js";
import type { createCreateProductionTaskHandler } from "./infrastructure/handlers/admin/create-production-task.handler.js";
import type { createCreateStockHoldHandler } from "./infrastructure/handlers/admin/create-stock-hold.handler.js";
import type {
  createLinkArtistIdentityHandler,
  createUnlinkArtistIdentityHandler,
} from "./infrastructure/handlers/admin/link-artist-identity.handler.js";
import type { createMarkPayoutPaidHandler } from "./infrastructure/handlers/admin/mark-payout-paid.handler.js";
import type { createMarkRefundSettledOutsideHandler } from "./infrastructure/handlers/admin/mark-refund-settled-outside.handler.js";
import type { createRecordPossessionHandler } from "./infrastructure/handlers/admin/record-possession.handler.js";
import type { createRejectSaleAuthorityRequestHandler } from "./infrastructure/handlers/admin/reject-sale-authority-request.handler.js";
import type { createRequestRefundHandler } from "./infrastructure/handlers/admin/request-refund.handler.js";
import type { createRetryRefundHandler } from "./infrastructure/handlers/admin/retry-refund.handler.js";
import type { createUpdateFramingTaskHandler } from "./infrastructure/handlers/admin/update-framing-task.handler.js";
import type { createUpdateFulfilmentHandler } from "./infrastructure/handlers/admin/update-fulfilment.handler.js";
import type { AdminIdempotency } from "./infrastructure/idempotent-admin-command.js";
import type { HealthDeps } from "./routes/health.routes.js";

export type AdminRoutesDeps = {
  featureFlags: ShopFeatureFlagsReader;
  stepUpMaxAuthAgeSeconds: number;
  health: HealthDeps;
  importArtwork: (
    command: ImportArtworkCommand,
    ctx: AdminIdempotency,
  ) => ReturnType<ArtworkImportWriter["importArtwork"]>;
  grantSaleAuthority: (
    command: GrantSaleAuthorityCommand,
    ctx: AdminIdempotency,
  ) => ReturnType<SaleAuthorityWriter["grantSaleAuthority"]>;
  getSaleAuthorityRequest: AdminReadPorts["saleAuthorityRequests"]["getRequestById"];
  rejectSaleAuthorityRequest: ReturnType<typeof createRejectSaleAuthorityRequestHandler>;
  adminRead: AdminReadPorts;
  enquiryInbox: EnquiryInboxService;
  /** Erasing a guest's personal data on request. */
  guestErasure: GuestErasureService;
  /** Guest leads: the list and one lead's record. */
  leads: LeadsService;
  /** The From Zoho queue: new artworks, conflicts, the latest check and each record. */
  artworkRegister: ArtworkRegisterReviewService;
  /** Offer on lax.art: check a From Zoho record and make the lax.art draft from it. */
  offerOnLaxArt: Pick<OfferOnLaxArtService, "assess" | "offer">;
  /** Link lax.art: match originals made before the register to their Zoho records, and link them. */
  zohoLink: Pick<
    ZohoLinkService,
    | "count"
    | "report"
    | "preview"
    | "search"
    | "link"
    | "linkBulk"
    | "unlink"
    | "settings"
    | "updateSettings"
  >;
  /** Release alert subscriber counts. */
  releaseAlertSummary: ReleaseAlertSummaryReader;
  /** The printers and publishers list in Settings. */
  printParties: PrintPartyStore;
  artistApplicationReview: ArtistApplicationReviewService;
  productionTasks: ProductionTaskService;
  savedViews: SavedViewService;
  staffReader: ShopStaffMemberReader;
  createProductionTask: ReturnType<typeof createCreateProductionTaskHandler>;
  /** Moves the work on a frame sold with a print to its next step. */
  updateFramingTask: ReturnType<typeof createUpdateFramingTaskHandler>;
  updateFulfilment: ReturnType<typeof createUpdateFulfilmentHandler>;
  recordPossession: ReturnType<typeof createRecordPossessionHandler>;
  cancelAfterPossession: ReturnType<typeof createCancelAfterPossessionHandler>;
  requestRefund: ReturnType<typeof createRequestRefundHandler>;
  retryRefund: ReturnType<typeof createRetryRefundHandler>;
  markRefundSettledOutside: ReturnType<typeof createMarkRefundSettledOutsideHandler>;
  advanceReturn: ReturnType<typeof createAdvanceReturnHandler>;
  markPayoutPaid: ReturnType<typeof createMarkPayoutPaidHandler>;
  saleFees: {
    approveFee(
      command: ApproveSaleFeeCommand,
      ctx: AdminIdempotency,
    ): ReturnType<SaleFeeWriter["approveFee"]>;
  };
  stockHolds: {
    releaseHold(
      command: ReleaseStockHoldCommand,
      ctx: AdminIdempotency,
    ): ReturnType<StockHoldWriter["releaseHold"]>;
  };
  createStockHold: ReturnType<typeof createCreateStockHoldHandler>;
  adjustMerchandiseStock: ReturnType<typeof createAdjustMerchandiseStockHandler>;
  createMerchandiseProduct: ReturnType<typeof createCreateMerchandiseProductHandler>;
  merchandiseCatalogue: MerchandiseCatalogueWriter;
  artworkCatalogue: ArtworkCatalogueWriter;
  /** Offering an original at auction in LAX Bid. */
  inventoryMoves: Pick<
    OriginalMoveService,
    "assess" | "assessRegister" | "listSales" | "offerAtAuction" | "offerRegisterAtAuction"
  >;
  /** Runs of prints: change a draft's run, edition facts, open edition stock, linked listings. */
  editionRuns: Omit<EditionRunServices, "recorder" | "originalPrintsRecorder">;
  /** Packing: the pick list, confirming the print in hand, swaps and certificates. */
  printFulfilment: PrintFulfilmentServices;
  artistCatalogue: ArtistCatalogueWriter;
  /** Refreshes lax.art after catalogue writes that change what it serves. */
  artCache: ArtCacheInvalidator;
  /** Featured on home: the prints, artists and categories the home pages feature. */
  homeFeatures: HomeFeaturesService;
  /** The framing catalogue: options, their prices per size band and lead times. */
  framing: FramingService;
  /** Framing on an edition: how it is sold, its offered options and their own prices. */
  editionFraming: EditionFramingService;
  /** Where the Shop delivers: regions, lead times, fixed prices and countries not delivered to. */
  deliveryRegions: DeliveryRegionsService;
  thirdPartySales: {
    recordSale(
      command: RecordThirdPartySaleCommand,
      ctx: AdminIdempotency,
    ): ReturnType<ThirdPartySaleWriter["recordSale"]>;
  };
  originalSales: Omit<OriginalSaleWriter, "createReservation"> & {
    createReservation(
      command: CreateOriginalSaleCommand,
      ctx: AdminIdempotency,
    ): ReturnType<OriginalSaleWriter["createReservation"]>;
  };
  linkArtistIdentity: ReturnType<typeof createLinkArtistIdentityHandler>;
  unlinkArtistIdentity: ReturnType<typeof createUnlinkArtistIdentityHandler>;
  updateArtistSeo: ArtistSeoWriter["updateArtistSeo"];
  shopMediaUpload: ShopMediaUploadHandlers | null;
};
