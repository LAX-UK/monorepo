import type { AbsenteeBidService } from "../services/absentee-bid.service.js";
import type { AutoBidService } from "../services/auto-bid.service.js";
import type { IBidRefusalObserver } from "../services/bidding/bid-limit-refusal.notifier.js";
import { BiddingAbsenteeBidHttpApplicationService } from "../services/bidding/bidding-absentee-bid-http-application.service.js";
import { BiddingAutoBidHttpApplicationService } from "../services/bidding/bidding-auto-bid-http-application.service.js";
import { BiddingConditionReportHttpApplicationService } from "../services/bidding/bidding-condition-report-http-application.service.js";
import { BiddingLotBidHistoryHttpApplicationService } from "../services/bidding/bidding-lot-bid-history-http-application.service.js";
import { BiddingLotViewerHttpApplicationService } from "../services/bidding/bidding-lot-viewer-http-application.service.js";
import { BiddingPlaceBidHttpApplicationService } from "../services/bidding/bidding-place-bid-http-application.service.js";
import { BiddingSaleRegistrationHttpApplicationService } from "../services/bidding/bidding-sale-registration-http-application.service.js";
import { BiddingSaleroomDisplayHttpApplicationService } from "../services/bidding/bidding-saleroom-display-http-application.service.js";
import { BiddingTelephoneBookingHttpApplicationService } from "../services/bidding/bidding-telephone-booking-http-application.service.js";
import type { BiddingRouteServices } from "../services/interfaces/bidding-routes/index.js";
import type { IConditionReportService } from "../services/interfaces/condition-report.js";
import type { IDisplayPairingService } from "../services/interfaces/display-pairing-service.js";
import type { IDisplaySnapshotReader } from "../services/interfaces/display-snapshot-reader.js";
import type { ILotService } from "../services/interfaces/lot-service.js";
import type { ILotViewerStateService } from "../services/interfaces/lot-viewer-state.js";
import type { IBidPlacerWithIdempotency } from "../services/interfaces/place-bid.js";
import type { ISaleRegistrationBuyerService } from "../services/interfaces/sale-registration-service.js";
import type { ITelephoneBidBookingBuyerService } from "../services/interfaces/telephone-bid-booking-service.js";

export type CreateBiddingRouteServicesInput = {
  bidPlacer: IBidPlacerWithIdempotency;
  absenteeBidService: AbsenteeBidService;
  autoBidService: AutoBidService;
  conditionReportService: IConditionReportService;
  saleRegistrationBuyer: ISaleRegistrationBuyerService;
  telephoneBidBookingBuyer: ITelephoneBidBookingBuyerService;
  lotService: ILotService;
  lotViewerState: ILotViewerStateService;
  displayPairingService: IDisplayPairingService;
  displaySnapshotReader: IDisplaySnapshotReader;
  /** Tells bidders (and owners and admins) when a bid is refused at a bidding limit. */
  bidRefusals?: IBidRefusalObserver | null;
};

export function createBiddingRouteServices(
  input: CreateBiddingRouteServicesInput,
): BiddingRouteServices {
  return {
    placeBidHttp: new BiddingPlaceBidHttpApplicationService(
      input.bidPlacer,
      input.bidRefusals ?? null,
    ),
    autoBidHttp: new BiddingAutoBidHttpApplicationService(
      input.autoBidService,
      input.bidRefusals ?? null,
    ),
    absenteeBidHttp: new BiddingAbsenteeBidHttpApplicationService(input.absenteeBidService),
    saleRegistrationHttp: new BiddingSaleRegistrationHttpApplicationService(
      input.saleRegistrationBuyer,
    ),
    telephoneBookingHttp: new BiddingTelephoneBookingHttpApplicationService(
      input.telephoneBidBookingBuyer,
    ),
    lotBidHistoryHttp: new BiddingLotBidHistoryHttpApplicationService(input.lotService),
    lotViewerHttp: new BiddingLotViewerHttpApplicationService(input.lotViewerState),
    conditionReportHttp: new BiddingConditionReportHttpApplicationService(
      input.conditionReportService,
    ),
    saleroomDisplayHttp: new BiddingSaleroomDisplayHttpApplicationService(
      input.displayPairingService,
      input.displaySnapshotReader,
    ),
  };
}
