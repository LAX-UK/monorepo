import type { ILotFulfilmentRepository } from "@auction/persistence/interfaces";
import type { IAdminLotFulfilmentApplicationService } from "../interfaces/admin-routes.js";
import type { ILotFulfilmentAdminService } from "../interfaces/lot-fulfilment-service.js";
import type { AdminLotFulfilmentListPage } from "./admin-lot-fulfilment-list-query.service.js";
import { AdminLotFulfilmentListQueryService } from "./admin-lot-fulfilment-list-query.service.js";

export class AdminLotFulfilmentApplicationService implements IAdminLotFulfilmentApplicationService {
  private readonly listQuery: AdminLotFulfilmentListQueryService;

  constructor(
    private readonly fulfilment: ILotFulfilmentAdminService,
    fulfilmentRepository: ILotFulfilmentRepository,
  ) {
    this.listQuery = new AdminLotFulfilmentListQueryService(fulfilmentRepository);
  }

  getPage(
    ...args: Parameters<AdminLotFulfilmentListQueryService["getPage"]>
  ): Promise<AdminLotFulfilmentListPage> {
    return this.listQuery.getPage(...args);
  }

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
