import type { IBiddingAbsenteeBidHttpApplicationService } from "./bidding-absentee-bid-http.js";
import type { IBiddingAutoBidHttpApplicationService } from "./bidding-auto-bid-http.js";
import type { IBiddingConditionReportHttpApplicationService } from "./bidding-condition-report-http.js";
import type { IBiddingLotBidHistoryHttpApplicationService } from "./bidding-lot-bid-history-http.js";
import type { IBiddingPlaceBidHttpApplicationService } from "./bidding-place-bid-http.js";
import type { IBiddingSaleRegistrationHttpApplicationService } from "./bidding-sale-registration-http.js";
import type { IBiddingSaleroomDisplayHttpApplicationService } from "./bidding-saleroom-display-http.js";
import type { IBiddingTelephoneBookingHttpApplicationService } from "./bidding-telephone-booking-http.js";

export type BiddingRouteServices = {
  placeBidHttp: IBiddingPlaceBidHttpApplicationService;
  autoBidHttp: IBiddingAutoBidHttpApplicationService;
  absenteeBidHttp: IBiddingAbsenteeBidHttpApplicationService;
  saleRegistrationHttp: IBiddingSaleRegistrationHttpApplicationService;
  telephoneBookingHttp: IBiddingTelephoneBookingHttpApplicationService;
  lotBidHistoryHttp: IBiddingLotBidHistoryHttpApplicationService;
  conditionReportHttp: IBiddingConditionReportHttpApplicationService;
  saleroomDisplayHttp: IBiddingSaleroomDisplayHttpApplicationService;
};

export type {
  IBiddingAbsenteeBidHttpApplicationService,
  IBiddingAutoBidHttpApplicationService,
  IBiddingConditionReportHttpApplicationService,
  IBiddingLotBidHistoryHttpApplicationService,
  IBiddingPlaceBidHttpApplicationService,
  IBiddingSaleRegistrationHttpApplicationService,
  IBiddingSaleroomDisplayHttpApplicationService,
  IBiddingTelephoneBookingHttpApplicationService,
};
