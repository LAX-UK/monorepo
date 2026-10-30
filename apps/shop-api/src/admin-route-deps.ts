import type { ArtistApplicationReviewService } from "./application/artist-applications/artist-application-review.service.js";
import type { EditionRunServices } from "./application/edition-runs/edition-run-services.js";
import type { EnquiryInboxService } from "./application/enquiry-inbox.service.js";
import type { GuestErasureService } from "./application/guest-erasure/guest-erasure.service.js";
import type { ShopMediaUploadHandlers } from "./application/handlers/shop-media-upload.handler.js";
import type { HomeFeaturesService } from "./application/home-features/home-features.service.js";
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
import type { ProductionTaskService } from "./application/production-task.service.js";
import type { SavedViewService } from "./application/saved-view.service.js";
import type { createAdjustMerchandiseStockHandler } from "./infrastructure/handlers/admin/adjust-merchandise-stock.handler.js";
import type { createCancelAfterPossessionHandler } from "./infrastructure/handlers/admin/cancel-after-possession.handler.js";
import type { createCreateMerchandiseProductHandler } from "./infrastructure/handlers/admin/create-merchandise-product.handler.js";
import type { createCreateProductionTaskHandler } from "./infrastructure/handlers/admin/create-production-task.handler.js";
import type { createCreateStockHoldHandler } from "./infrastructure/handlers/admin/create-stock-hold.handler.js";
import type {
  createLinkArtistIdentityHandler,
  createUnlinkArtistIdentityHandler,
} from "./infrastructure/handlers/admin/link-artist-identity.handler.js";
import type { createMarkPayoutPaidHandler } from "./infrastructure/handlers/admin/mark-payout-paid.handler.js";
import type { createRecordPossessionHandler } from "./infrastructure/handlers/admin/record-possession.handler.js";
import type { createRejectSaleAuthorityRequestHandler } from "./infrastructure/handlers/admin/reject-sale-authority-request.handler.js";
import type { createRequestRefundHandler } from "./infrastructure/handlers/admin/request-refund.handler.js";
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
  artistApplicationReview: ArtistApplicationReviewService;
  productionTasks: ProductionTaskService;
  savedViews: SavedViewService;
  staffReader: ShopStaffMemberReader;
  createProductionTask: ReturnType<typeof createCreateProductionTaskHandler>;
  updateFulfilment: ReturnType<typeof createUpdateFulfilmentHandler>;
  recordPossession: ReturnType<typeof createRecordPossessionHandler>;
  cancelAfterPossession: ReturnType<typeof createCancelAfterPossessionHandler>;
  requestRefund: ReturnType<typeof createRequestRefundHandler>;
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
  /** Runs of prints: change a draft's run, edition facts, open edition stock, linked listings. */
  editionRuns: Omit<EditionRunServices, "recorder">;
  artistCatalogue: ArtistCatalogueWriter;
  /** Refreshes lax.art after catalogue writes that change what it serves. */
  artCache: ArtCacheInvalidator;
  /** Featured on home: the prints, artists and categories the home pages feature. */
  homeFeatures: HomeFeaturesService;
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
