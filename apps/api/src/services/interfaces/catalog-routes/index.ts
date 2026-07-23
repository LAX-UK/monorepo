import type { ICatalogArtistHttpApplicationService } from "./catalog-artist-http.js";
import type { ICatalogCategoryReadHttpApplicationService } from "./catalog-category-read-http.js";
import type { ICatalogLotLifecycleHttpApplicationService } from "./catalog-lot-lifecycle-http.js";
import type { ICatalogLotReadHttpApplicationService } from "./catalog-lot-read-http.js";
import type { ICatalogPressReadHttpApplicationService } from "./catalog-press-read-http.js";
import type { ICatalogSaleFollowHttpApplicationService } from "./catalog-sale-follow-http.js";
import type { ICatalogSaleLifecycleHttpApplicationService } from "./catalog-sale-lifecycle-http.js";
import type { ICatalogSaleLotMembershipHttpApplicationService } from "./catalog-sale-lot-membership-http.js";
import type { ICatalogSaleReadHttpApplicationService } from "./catalog-sale-read-http.js";
import type { ICatalogVenueHttpApplicationService } from "./catalog-venue-http.js";

export type CatalogRouteServices = {
  lotReadHttp: ICatalogLotReadHttpApplicationService;
  saleReadHttp: ICatalogSaleReadHttpApplicationService;
  categoryReadHttp: ICatalogCategoryReadHttpApplicationService;
  pressReadHttp: ICatalogPressReadHttpApplicationService;
  saleLifecycleHttp: ICatalogSaleLifecycleHttpApplicationService;
  saleLotMembershipHttp: ICatalogSaleLotMembershipHttpApplicationService;
  lotLifecycleHttp: ICatalogLotLifecycleHttpApplicationService;
  saleFollowHttp: ICatalogSaleFollowHttpApplicationService;
  artistHttp: ICatalogArtistHttpApplicationService;
  venueHttp: ICatalogVenueHttpApplicationService;
};

export type {
  CatalogHttpJson,
  CatalogViewerContext,
} from "./catalog-read-http.js";
export type { ICatalogLotReadHttpApplicationService } from "./catalog-lot-read-http.js";
export type { ICatalogSaleReadHttpApplicationService } from "./catalog-sale-read-http.js";
export type { ICatalogCategoryReadHttpApplicationService } from "./catalog-category-read-http.js";
export type { ICatalogPressReadHttpApplicationService } from "./catalog-press-read-http.js";

export type {
  CatalogRouteErr,
  CatalogRouteNoContent,
  CatalogRouteOk,
  CatalogRouteOutcome,
} from "./catalog-route-http.js";
export type { ICatalogSaleLifecycleHttpApplicationService } from "./catalog-sale-lifecycle-http.js";
export type { ICatalogSaleLotMembershipHttpApplicationService } from "./catalog-sale-lot-membership-http.js";
export type { ICatalogLotLifecycleHttpApplicationService } from "./catalog-lot-lifecycle-http.js";
export type { ILotLifecycleTransitionExecutor } from "./catalog-lot-lifecycle-transition-executor.js";
export type { ICatalogSaleFollowHttpApplicationService } from "./catalog-sale-follow-http.js";
export type { ICatalogArtistHttpApplicationService } from "./catalog-artist-http.js";
export type { ICatalogVenueHttpApplicationService } from "./catalog-venue-http.js";

export type {
  CatalogCategoryReadRoutesContainer,
  CatalogLotReadRoutesContainer,
  CatalogLotLifecycleWriteRoutesContainer,
  CatalogPressReadRoutesContainer,
  CatalogSaleFollowRoutesContainer,
  CatalogSaleLifecycleWriteRoutesContainer,
  CatalogSaleLotMembershipRoutesContainer,
  CatalogSaleReadRoutesContainer,
  CatalogArtistRoutesContainer,
  CatalogVenueRoutesContainer,
} from "./catalog-route-container-slices.js";
