import type { CatalogRouteOutcome } from "./catalog-route-http.js";

export type SaleFollowStatus = { isFollowing: boolean };

export interface ICatalogSaleFollowHttpApplicationService {
  follow(input: { userId: string; saleId: string }): Promise<CatalogRouteOutcome<SaleFollowStatus>>;

  unfollow(input: { userId: string; saleId: string }): Promise<
    CatalogRouteOutcome<SaleFollowStatus>
  >;

  getStatus(input: { userId: string; saleId: string }): Promise<
    CatalogRouteOutcome<SaleFollowStatus>
  >;
}
