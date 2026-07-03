import type { IAdminLotFulfilmentApplicationService } from "../interfaces/admin-routes.js";
import type { ILotFulfilmentAdminService } from "../interfaces/lot-fulfilment-service.js";

export class AdminLotFulfilmentApplicationService implements IAdminLotFulfilmentApplicationService {
  constructor(private readonly fulfilment: ILotFulfilmentAdminService) {}

  listForAdmin(...args: Parameters<ILotFulfilmentAdminService["listForAdmin"]>) {
    return this.fulfilment.listForAdmin(...args);
  }

  getByLotIdForAdmin(...args: Parameters<ILotFulfilmentAdminService["getByLotIdForAdmin"]>) {
    return this.fulfilment.getByLotIdForAdmin(...args);
  }

  approveRelease(...args: Parameters<ILotFulfilmentAdminService["approveRelease"]>) {
    return this.fulfilment.approveRelease(...args);
  }

  markShipped(...args: Parameters<ILotFulfilmentAdminService["markShipped"]>) {
    return this.fulfilment.markShipped(...args);
  }

  markReadyForCollection(
    ...args: Parameters<ILotFulfilmentAdminService["markReadyForCollection"]>
  ) {
    return this.fulfilment.markReadyForCollection(...args);
  }

  markDelivered(...args: Parameters<ILotFulfilmentAdminService["markDelivered"]>) {
    return this.fulfilment.markDelivered(...args);
  }

  markCollected(...args: Parameters<ILotFulfilmentAdminService["markCollected"]>) {
    return this.fulfilment.markCollected(...args);
  }
}
