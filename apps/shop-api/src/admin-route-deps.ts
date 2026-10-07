import type { ImportArtworkHandler } from "./application/handlers/import-artwork.handler.js";
import type { AdminReadPorts } from "./application/ports/admin-readers.js";
import type { OriginalSaleWriter } from "./application/ports/original-sale.writer.js";
import type { SaleAuthorityWriter } from "./application/ports/sale-authority.writer.js";
import type { SaleFeeWriter } from "./application/ports/sale-fee.writer.js";
import type { ShopFeatureFlagsReader } from "./application/ports/shop-feature-flags.js";
import type { ShopStaffMemberReader } from "./application/ports/staff-member.reader.js";
import type { StockHoldWriter } from "./application/ports/stock-hold.writer.js";
import type { ThirdPartySaleWriter } from "./application/ports/third-party-sale.writer.js";
import type { createAdjustMerchandiseStockHandler } from "./infrastructure/handlers/admin/adjust-merchandise-stock.handler.js";
import type { createCancelAfterPossessionHandler } from "./infrastructure/handlers/admin/cancel-after-possession.handler.js";
import type { createCreateProductionTaskHandler } from "./infrastructure/handlers/admin/create-production-task.handler.js";
import type { createCreateStockHoldHandler } from "./infrastructure/handlers/admin/create-stock-hold.handler.js";
import type {
  createGrantStaffRoleHandler,
  createRevokeStaffRoleHandler,
} from "./infrastructure/handlers/admin/grant-staff-role.handler.js";
import type {
  createLinkArtistIdentityHandler,
  createUnlinkArtistIdentityHandler,
} from "./infrastructure/handlers/admin/link-artist-identity.handler.js";
import type { createMarkPayoutPaidHandler } from "./infrastructure/handlers/admin/mark-payout-paid.handler.js";
import type { createRecordPossessionHandler } from "./infrastructure/handlers/admin/record-possession.handler.js";
import type { createRejectSaleAuthorityRequestHandler } from "./infrastructure/handlers/admin/reject-sale-authority-request.handler.js";
import type { createRequestRefundHandler } from "./infrastructure/handlers/admin/request-refund.handler.js";
import type { createUpdateFulfilmentHandler } from "./infrastructure/handlers/admin/update-fulfilment.handler.js";
import type { HealthDeps } from "./routes/health.routes.js";

export type AdminRoutesDeps = {
  featureFlags: ShopFeatureFlagsReader;
  financeMaxAuthAgeSeconds: number;
  health: HealthDeps;
  importArtwork: ImportArtworkHandler;
  grantSaleAuthority: SaleAuthorityWriter["grantSaleAuthority"];
  getSaleAuthorityRequest: AdminReadPorts["saleAuthorityRequests"]["getRequestById"];
  rejectSaleAuthorityRequest: ReturnType<typeof createRejectSaleAuthorityRequestHandler>;
  grantStaffRole: ReturnType<typeof createGrantStaffRoleHandler>;
  revokeStaffRole: ReturnType<typeof createRevokeStaffRoleHandler>;
  adminRead: AdminReadPorts;
  staffReader: ShopStaffMemberReader;
  createProductionTask: ReturnType<typeof createCreateProductionTaskHandler>;
  updateFulfilment: ReturnType<typeof createUpdateFulfilmentHandler>;
  recordPossession: ReturnType<typeof createRecordPossessionHandler>;
  cancelAfterPossession: ReturnType<typeof createCancelAfterPossessionHandler>;
  requestRefund: ReturnType<typeof createRequestRefundHandler>;
  markPayoutPaid: ReturnType<typeof createMarkPayoutPaidHandler>;
  saleFees: SaleFeeWriter;
  stockHolds: StockHoldWriter;
  createStockHold: ReturnType<typeof createCreateStockHoldHandler>;
  adjustMerchandiseStock: ReturnType<typeof createAdjustMerchandiseStockHandler>;
  thirdPartySales: ThirdPartySaleWriter;
  originalSales: OriginalSaleWriter;
  linkArtistIdentity: ReturnType<typeof createLinkArtistIdentityHandler>;
  unlinkArtistIdentity: ReturnType<typeof createUnlinkArtistIdentityHandler>;
};
