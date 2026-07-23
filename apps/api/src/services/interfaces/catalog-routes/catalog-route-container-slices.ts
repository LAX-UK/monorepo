import type { CatalogRouteServices } from "./index.js";

type CatalogRoutePick<K extends keyof CatalogRouteServices> = {
  catalogRoutes: Pick<CatalogRouteServices, K>;
};

export type CatalogLotReadRoutesContainer = CatalogRoutePick<"lotReadHttp"> &
  Pick<import("../../../container.js").Container, "userSuspensionChecker" | "bidding">;

export type CatalogSaleReadRoutesContainer = CatalogRoutePick<"saleReadHttp"> &
  Pick<import("../../../container.js").Container, "userSuspensionChecker">;

export type CatalogCategoryReadRoutesContainer = CatalogRoutePick<"categoryReadHttp">;

export type CatalogPressReadRoutesContainer = CatalogRoutePick<"pressReadHttp"> &
  Pick<import("../../../container.js").Container, "userSuspensionChecker">;

export type CatalogSaleFollowRoutesContainer = CatalogRoutePick<"saleFollowHttp">;

export type CatalogSaleLifecycleWriteRoutesContainer = CatalogRoutePick<"saleLifecycleHttp"> &
  Pick<import("../../../container.js").Container, "userSuspensionChecker" | "kycService">;

export type CatalogSaleLotMembershipRoutesContainer = CatalogRoutePick<"saleLotMembershipHttp"> &
  Pick<import("../../../container.js").Container, "userSuspensionChecker" | "kycService">;

export type CatalogLotLifecycleWriteRoutesContainer = CatalogRoutePick<"lotLifecycleHttp"> &
  Pick<
    import("../../../container.js").Container,
    "userSuspensionChecker" | "kycService" | "env" | "redis" | "db"
  >;

export type CatalogArtistRoutesContainer = CatalogRoutePick<"artistHttp"> &
  Pick<import("../../../container.js").Container, "userSuspensionChecker">;

export type CatalogVenueRoutesContainer = CatalogRoutePick<"venueHttp"> &
  Pick<import("../../../container.js").Container, "userSuspensionChecker">;
