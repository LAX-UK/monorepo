import type { AdminSaleOperationsSnapshotService } from "../admin-sale-operations-snapshot.service.js";
import type { IAdminSaleroomApplicationService } from "../interfaces/admin-routes.js";
import type {
  ISaleroomDisplayControlService,
  ISaleroomSessionControlService,
  ISaleroomSessionReadService,
} from "../interfaces/saleroom-service.js";

export class AdminSaleroomApplicationService implements IAdminSaleroomApplicationService {
  constructor(
    private readonly sessionRead: ISaleroomSessionReadService,
    private readonly sessionControl: ISaleroomSessionControlService,
    private readonly displayControl: ISaleroomDisplayControlService,
    private readonly operationsSnapshot: AdminSaleOperationsSnapshotService,
  ) {}

  goLive(...args: Parameters<ISaleroomSessionControlService["goLive"]>) {
    return this.sessionControl.goLive(...args);
  }

  pause(...args: Parameters<ISaleroomSessionControlService["pause"]>) {
    return this.sessionControl.pause(...args);
  }

  resume(...args: Parameters<ISaleroomSessionControlService["resume"]>) {
    return this.sessionControl.resume(...args);
  }

  advanceToLot(...args: Parameters<ISaleroomSessionControlService["advanceToLot"]>) {
    return this.sessionControl.advanceToLot(...args);
  }

  hammerCurrentLot(...args: Parameters<ISaleroomSessionControlService["hammerCurrentLot"]>) {
    return this.sessionControl.hammerCurrentLot(...args);
  }

  noSaleCurrentLot(...args: Parameters<ISaleroomSessionControlService["noSaleCurrentLot"]>) {
    return this.sessionControl.noSaleCurrentLot(...args);
  }

  closeSession(...args: Parameters<ISaleroomSessionControlService["closeSession"]>) {
    return this.sessionControl.closeSession(...args);
  }

  getSessionStatuses(...args: Parameters<ISaleroomSessionReadService["getSessionStatuses"]>) {
    return this.sessionRead.getSessionStatuses(...args);
  }

  getSessionWithRecentEvents(
    ...args: Parameters<ISaleroomSessionReadService["getSessionWithRecentEvents"]>
  ) {
    return this.sessionRead.getSessionWithRecentEvents(...args);
  }

  publishClerkPaddleBidSummary(
    ...args: Parameters<ISaleroomDisplayControlService["publishClerkPaddleBidSummary"]>
  ) {
    return this.displayControl.publishClerkPaddleBidSummary(...args);
  }

  getOperationsSnapshot(saleId: string) {
    return this.operationsSnapshot.getSnapshot(saleId);
  }

  listOperationsRadar(limit?: number) {
    return this.operationsSnapshot.listOperationsRadar(limit);
  }
}
