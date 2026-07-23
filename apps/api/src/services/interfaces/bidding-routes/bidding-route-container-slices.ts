import type { BiddingRouteServices } from "./index.js";

type BiddingRoutePick<K extends keyof BiddingRouteServices> = {
  bidding: Pick<BiddingRouteServices, K>;
};

export type BiddingPlaceBidRoutesContainer = BiddingRoutePick<"placeBidHttp"> &
  Pick<
    import("../../../container.js").Container,
    | "env"
    | "redis"
    | "userSuspensionChecker"
    | "kycService"
    | "requireSubmissionsLegalEntityContext"
  >;

export type BiddingLotParticipationRoutesContainer = BiddingRoutePick<
  "autoBidHttp" | "absenteeBidHttp" | "conditionReportHttp"
> &
  Pick<
    import("../../../container.js").Container,
    | "env"
    | "redis"
    | "userSuspensionChecker"
    | "kycService"
    | "requireSubmissionsLegalEntityContext"
  >;

export type BiddingLotBidHistoryRoutesContainer = BiddingRoutePick<"lotBidHistoryHttp">;

export type BiddingSaleRegistrationRoutesContainer = BiddingRoutePick<"saleRegistrationHttp"> &
  Pick<
    import("../../../container.js").Container,
    "userSuspensionChecker" | "kycService" | "requireSubmissionsLegalEntityContext"
  >;

export type BiddingTelephoneBookingRoutesContainer = BiddingRoutePick<"telephoneBookingHttp"> &
  Pick<import("../../../container.js").Container, "userSuspensionChecker" | "kycService">;

export type BiddingSaleroomAdminRoutesContainer = Pick<
  import("../../../container.js").Container,
  "saleroomService" | "bidService"
>;
