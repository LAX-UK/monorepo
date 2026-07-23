import type { CatalogRouteOutcome } from "../interfaces/catalog-routes/catalog-route-http.js";
import type {
  ICatalogSaleFollowHttpApplicationService,
  SaleFollowStatus,
} from "../interfaces/catalog-routes/catalog-sale-follow-http.js";
import type { SaleFollowService } from "../sale-follow.service.js";

function notFoundError(): Error {
  const error = new Error("Not found");
  (error as Error & { status: number }).status = 404;
  return error;
}

export class CatalogSaleFollowHttpApplicationService
  implements ICatalogSaleFollowHttpApplicationService
{
  constructor(private readonly saleFollowService: SaleFollowService) {}

  async follow(input: {
    userId: string;
    saleId: string;
  }): Promise<CatalogRouteOutcome<SaleFollowStatus>> {
    const row = await this.saleFollowService.follow(input.userId, input.saleId);
    if (!row) return { kind: "err", error: notFoundError() };
    return { kind: "ok", data: { isFollowing: true } };
  }

  async unfollow(input: {
    userId: string;
    saleId: string;
  }): Promise<CatalogRouteOutcome<SaleFollowStatus>> {
    await this.saleFollowService.unfollow(input.userId, input.saleId);
    return { kind: "ok", data: { isFollowing: false } };
  }

  async getStatus(input: {
    userId: string;
    saleId: string;
  }): Promise<CatalogRouteOutcome<SaleFollowStatus>> {
    const isFollowing = await this.saleFollowService.isFollowing(input.userId, input.saleId);
    return { kind: "ok", data: { isFollowing } };
  }
}
