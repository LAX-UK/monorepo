import type { IAdminLotFulfilmentApplicationService } from "../interfaces/admin-routes.js";
import type { LotFulfilmentService } from "../lot-fulfilment.service.js";

export class AdminLotFulfilmentApplicationService implements IAdminLotFulfilmentApplicationService {
  constructor(private readonly fulfilment: LotFulfilmentService) {}

  listForAdmin(...args: Parameters<LotFulfilmentService["listForAdmin"]>) {
    return this.fulfilment.listForAdmin(...args);
  }

  getByLotIdForAdmin(...args: Parameters<LotFulfilmentService["getByLotIdForAdmin"]>) {
    return this.fulfilment.getByLotIdForAdmin(...args);
  }

  approveRelease(...args: Parameters<LotFulfilmentService["approveRelease"]>) {
    return this.fulfilment.approveRelease(...args);
  }

  markShipped(...args: Parameters<LotFulfilmentService["markShipped"]>) {
    return this.fulfilment.markShipped(...args);
  }

  markReadyForCollection(...args: Parameters<LotFulfilmentService["markReadyForCollection"]>) {
    return this.fulfilment.markReadyForCollection(...args);
  }

  markDelivered(...args: Parameters<LotFulfilmentService["markDelivered"]>) {
    return this.fulfilment.markDelivered(...args);
  }

  markCollected(...args: Parameters<LotFulfilmentService["markCollected"]>) {
    return this.fulfilment.markCollected(...args);
  }
}
