import type { AbsenteeBidService } from "../services/absentee-bid.service.js";
import type { AutoBidService } from "../services/auto-bid.service.js";
import type { BiddingRouteServices } from "../services/interfaces/bidding-routes.js";
import type { IConditionReportService } from "../services/interfaces/condition-report.js";

export type CreateBiddingRouteServicesInput = {
  absenteeBidService: AbsenteeBidService;
  autoBidService: AutoBidService;
  conditionReportService: IConditionReportService;
};

export function createBiddingRouteServices(
  input: CreateBiddingRouteServicesInput,
): BiddingRouteServices {
  return {
    absenteeBidService: input.absenteeBidService,
    autoBidService: input.autoBidService,
    conditionReportService: input.conditionReportService,
  };
}
