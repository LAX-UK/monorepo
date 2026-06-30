import type { AbsenteeBidService } from "../absentee-bid.service.js";
import type { AutoBidService } from "../auto-bid.service.js";
import type { IConditionReportService } from "./condition-report.js";

export type BiddingRouteServices = {
  absenteeBidService: AbsenteeBidService;
  autoBidService: AutoBidService;
  conditionReportService: IConditionReportService;
};
