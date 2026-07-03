import type { Lot } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import type {
  ConditionReportRequestListRow,
  ConditionReportRequestRow,
  ConditionReportServiceError,
  FulfillConditionReportInput,
  IConditionReportAdminService,
} from "../interfaces/condition-report.js";
import type { ConditionReportContext } from "./condition-report-context.js";
import { ConditionReportFulfilmentService } from "./condition-report-fulfilment.service.js";

export class ConditionReportAdminService implements IConditionReportAdminService {
  private readonly fulfilment: ConditionReportFulfilmentService;

  constructor(private readonly ctx: ConditionReportContext) {
    this.fulfilment = new ConditionReportFulfilmentService(ctx);
  }

  async listForAdmin(input: {
    status?: "open" | "pending" | "in_progress" | "fulfilled" | "declined" | undefined;
    lotId?: string | undefined;
    limit: number;
    offset: number;
  }): Promise<{ items: ConditionReportRequestListRow[]; total: number }> {
    return this.ctx.requestRepo.listForAdmin(input);
  }

  async markInProgress(input: {
    id: string;
    actorUserId: string;
  }): Promise<Result<ConditionReportRequestRow, ConditionReportServiceError>> {
    const reqRow = await this.ctx.requestRepo.findById(input.id);
    if (!reqRow) {
      return err({ message: "Request not found", status: 404 });
    }
    if (reqRow.status === "in_progress") {
      return ok(reqRow);
    }
    if (reqRow.status !== "pending") {
      return err({ message: "Only pending requests can be marked in progress", status: 400 });
    }

    const updated = await this.ctx.requestRepo.updateById(input.id, { status: "in_progress" });
    if (!updated) {
      return err({ message: "Could not update condition report request", status: 500 });
    }

    if (this.ctx.domainEventSink) {
      await this.ctx.domainEventSink.publish({
        aggregateType: "lot",
        aggregateId: reqRow.lotId,
        eventType: "condition_report.in_progress",
        payload: {
          requestId: input.id,
          markedByUserId: input.actorUserId,
        },
        actorUserId: input.actorUserId,
      });
    }

    return ok(updated);
  }

  fulfill(input: FulfillConditionReportInput): Promise<Result<Lot, ConditionReportServiceError>> {
    return this.fulfilment.fulfill(input);
  }

  decline(input: {
    id: string;
    fulfilledByUserId: string;
    responseNote?: string | undefined;
  }): Promise<Result<void, ConditionReportServiceError>> {
    return this.fulfilment.decline(input);
  }
}
