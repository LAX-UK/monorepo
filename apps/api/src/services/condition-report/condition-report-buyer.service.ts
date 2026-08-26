import type { Lot } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import type {
  BuyerConditionReportListRow,
  ConditionReportRequestRow,
  ConditionReportServiceError,
  IConditionReportBuyerService,
} from "../interfaces/condition-report.js";
import type { ConditionReportContext } from "./condition-report-context.js";
import { OPEN_LOT_STATUSES, OPEN_REQUEST_STATUSES } from "./condition-report-request.mapper.js";

export class ConditionReportBuyerService implements IConditionReportBuyerService {
  constructor(private readonly ctx: ConditionReportContext) {}

  async createRequest(input: {
    userId: string;
    lotId: string;
    requestingLegalEntityId?: string | undefined;
    requestNote?: string | undefined;
  }): Promise<Result<ConditionReportRequestRow, ConditionReportServiceError>> {
    if (!this.ctx.identityEligibilityGate) {
      return err({
        message: "Identity eligibility is not configured",
        status: 503,
        code: "identity_gate_unconfigured",
      });
    }
    const eligibility = await this.ctx.identityEligibilityGate.assertSelfServiceEligible(
      input.userId,
    );
    if (eligibility.isErr()) {
      return err({
        message: eligibility.error.message,
        status: eligibility.error.status,
        ...(eligibility.error.code ? { code: eligibility.error.code } : {}),
      });
    }

    const lotRow = await this.ctx.lotRepo.findById(input.lotId);
    if (!lotRow) {
      return err({ message: "Lot not found", status: 404 });
    }
    if (!OPEN_LOT_STATUSES.has(lotRow.status as Lot["status"])) {
      return err({
        message: "Condition report requests are only open for upcoming or live lots",
        status: 400,
        code: "lot_not_eligible",
      });
    }

    if (input.requestingLegalEntityId) {
      if (!this.ctx.legalEntityRepository) {
        return err({ message: "Legal entity context is not configured", status: 503 });
      }
      const mem = await this.ctx.legalEntityRepository.findActiveMembership(
        input.userId,
        input.requestingLegalEntityId,
      );
      if (!mem) {
        return err({ message: "Not a member of the selected legal entity", status: 403 });
      }
    }

    const existing = await this.ctx.requestRepo.findOpenByLotAndUser(input.lotId, input.userId);
    if (existing) {
      return ok(existing);
    }

    const priorRequest = await this.ctx.requestRepo.findAnyByLotAndUser(input.lotId, input.userId);
    if (priorRequest) {
      return err({
        message: "You have already requested a condition report for this lot",
        status: 409,
        code: "condition_report_already_requested",
      });
    }

    try {
      const row = await this.ctx.requestRepo.insert({
        lotId: input.lotId,
        requestedByUserId: input.userId,
        requestingLegalEntityId: input.requestingLegalEntityId ?? null,
        requestNote: input.requestNote ?? null,
      });

      if (this.ctx.domainEventSink) {
        await this.ctx.domainEventSink.publish({
          aggregateType: "lot",
          aggregateId: input.lotId,
          eventType: "condition_report.requested",
          payload: {
            requestId: row.id,
            requestedByUserId: input.userId,
            requestingLegalEntityId: input.requestingLegalEntityId ?? null,
          },
          actorUserId: input.userId,
        });
      }
      return ok(row);
    } catch {
      return err({ message: "Could not create condition report request", status: 500 });
    }
  }

  async findForBuyerOnLot(input: {
    userId: string;
    lotId: string;
  }): Promise<ConditionReportRequestRow | null> {
    const rows = await this.ctx.requestRepo.listByLotAndUser(input.lotId, input.userId);
    if (rows.length === 0) return null;

    const open = rows.find((r) => (OPEN_REQUEST_STATUSES as readonly string[]).includes(r.status));
    return open ?? rows[0] ?? null;
  }

  async listForBuyer(input: {
    userId: string;
    limit: number;
    offset: number;
  }): Promise<{ items: BuyerConditionReportListRow[]; total: number }> {
    return this.ctx.requestRepo.listForBuyer(input);
  }
}
