import type { ImportArtworkHandler } from "./application/handlers/import-artwork.handler.js";
import type { FulfilmentWriter } from "./application/ports/fulfilment.writer.js";
import type { OriginalSaleWriter } from "./application/ports/original-sale.writer.js";
import type { PayoutWriter } from "./application/ports/payout.writer.js";
import type { ProductionWriter } from "./application/ports/production.writer.js";
import type { RefundWriter } from "./application/ports/refund.writer.js";
import type { SaleAuthorityWriter } from "./application/ports/sale-authority.writer.js";
import type { SaleFeeWriter } from "./application/ports/sale-fee.writer.js";
import type { ShopStaffMemberReader } from "./application/ports/staff-member.reader.js";
import type { StockHoldWriter } from "./application/ports/stock-hold.writer.js";
import type { ThirdPartySaleWriter } from "./application/ports/third-party-sale.writer.js";
import type { HealthDeps } from "./routes/health.routes.js";

export type AdminRoutesDeps = {
  financeMaxAuthAgeSeconds: number;
  health: HealthDeps;
  importArtwork: ImportArtworkHandler;
  grantSaleAuthority: SaleAuthorityWriter["grantSaleAuthority"];
  staffReader: ShopStaffMemberReader;
  production: ProductionWriter;
  fulfilment: FulfilmentWriter;
  refunds: RefundWriter;
  payouts: PayoutWriter;
  saleFees: SaleFeeWriter;
  stockHolds: StockHoldWriter;
  thirdPartySales: ThirdPartySaleWriter;
  originalSales: OriginalSaleWriter;
};
