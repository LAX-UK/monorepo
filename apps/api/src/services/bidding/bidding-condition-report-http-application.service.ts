import type { ConditionReportRequestRow } from "@auction/persistence/interfaces";
import { resolveActingBuyerLegalEntity } from "../../lib/resolve-acting-buyer-legal-entity.js";
import type { IBiddingConditionReportHttpApplicationService } from "../interfaces/bidding-routes/bidding-condition-report-http.js";
import {
  type BiddingRouteOutcome,
  biddingRouteFromServiceResult,
} from "../interfaces/bidding-routes/bidding-route-http.js";
import type { IConditionReportService } from "../interfaces/condition-report.js";

export class BiddingConditionReportHttpApplicationService
  implements IBiddingConditionReportHttpApplicationService
{
  constructor(private readonly conditionReportService: IConditionReportService) {}

  async findForBuyerOnLot(input: {
    userId: string;
    lotId: string;
  }): Promise<BiddingRouteOutcome<ConditionReportRequestRow | null>> {
    const row = await this.conditionReportService.findForBuyerOnLot(input);
    return { kind: "ok", data: row };
  }

  async createRequest(input: {
    userId: string;
    lotId: string;
    requestNote?: string;
    actingLegalEntityId?: string | undefined;
    requestingLegalEntityId?: string | undefined;
  }): Promise<BiddingRouteOutcome<ConditionReportRequestRow>> {
    const entity = resolveActingBuyerLegalEntity({
      actingLegalEntityId: input.actingLegalEntityId,
      bodyLegalEntityId: input.requestingLegalEntityId,
    });
    if (entity.isErr()) return { kind: "err", error: entity.error };

    const result = await this.conditionReportService.createRequest({
      userId: input.userId,
      lotId: input.lotId,
      ...(input.requestNote !== undefined ? { requestNote: input.requestNote } : {}),
      requestingLegalEntityId: entity.value,
    });
    if (result.isErr()) {
      return biddingRouteFromServiceResult(result);
    }
    return { kind: "ok", data: result.value, status: 201 };
  }
}
