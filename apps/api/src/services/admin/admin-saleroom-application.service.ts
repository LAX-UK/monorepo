import type { AdminSaleOperationsSnapshotService } from "../admin-sale-operations-snapshot.service.js";
import type { IAdminSaleroomApplicationService } from "../interfaces/admin-routes.js";
import type { SaleroomService } from "../saleroom.service.js";

export class AdminSaleroomApplicationService implements IAdminSaleroomApplicationService {
  constructor(
    private readonly saleroom: SaleroomService,
    private readonly operationsSnapshot: AdminSaleOperationsSnapshotService,
  ) {}

  goLive(...args: Parameters<SaleroomService["goLive"]>) {
    return this.saleroom.goLive(...args);
  }

  pause(...args: Parameters<SaleroomService["pause"]>) {
    return this.saleroom.pause(...args);
  }

  resume(...args: Parameters<SaleroomService["resume"]>) {
    return this.saleroom.resume(...args);
  }

  advanceToLot(...args: Parameters<SaleroomService["advanceToLot"]>) {
    return this.saleroom.advanceToLot(...args);
  }

  hammerCurrentLot(...args: Parameters<SaleroomService["hammerCurrentLot"]>) {
    return this.saleroom.hammerCurrentLot(...args);
  }

  noSaleCurrentLot(...args: Parameters<SaleroomService["noSaleCurrentLot"]>) {
    return this.saleroom.noSaleCurrentLot(...args);
  }

  closeSession(...args: Parameters<SaleroomService["closeSession"]>) {
    return this.saleroom.closeSession(...args);
  }

  getSessionStatuses(...args: Parameters<SaleroomService["getSessionStatuses"]>) {
    return this.saleroom.getSessionStatuses(...args);
  }

  getSessionWithRecentEvents(...args: Parameters<SaleroomService["getSessionWithRecentEvents"]>) {
    return this.saleroom.getSessionWithRecentEvents(...args);
  }

  publishClerkPaddleBidSummary(
    ...args: Parameters<SaleroomService["publishClerkPaddleBidSummary"]>
  ) {
    return this.saleroom.publishClerkPaddleBidSummary(...args);
  }

  getOperationsSnapshot(saleId: string) {
    return this.operationsSnapshot.getSnapshot(saleId);
  }
}
