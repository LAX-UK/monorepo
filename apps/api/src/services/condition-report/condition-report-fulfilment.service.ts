import { lotNotDeleted } from "@auction/db";
import { lot } from "@auction/db/schema";
import { mergeLotMarketingDetailsPatch } from "@auction/persistence";
import type { Lot } from "@auction/types";
import { and, eq } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";
import type {
  ConditionReportServiceError,
  FulfillConditionReportInput,
  IConditionReportFulfilmentService,
} from "../interfaces/condition-report.js";
import { notificationRowToPayload } from "../notification-payload.js";
import type { NotificationFactory } from "../notification.factory.js";
import type { ConditionReportContext } from "./condition-report-context.js";

type ConditionReportNotificationPayload =
  | ReturnType<NotificationFactory["createConditionReportReady"]>
  | ReturnType<NotificationFactory["createConditionReportDeclined"]>;

export class ConditionReportFulfilmentService implements IConditionReportFulfilmentService {
  constructor(private readonly ctx: ConditionReportContext) {}

  private async notifyBuyerBestEffort(
    userId: string,
    payload: ConditionReportNotificationPayload,
  ): Promise<void> {
    if (!this.ctx.notificationDispatcher) return;
    try {
      await this.ctx.notificationDispatcher.dispatch(userId, notificationRowToPayload(payload));
    } catch {
      /* notification must not fail fulfilment */
    }
  }

  async fulfill(
    input: FulfillConditionReportInput,
  ): Promise<Result<Lot, ConditionReportServiceError>> {
    const reqRow = await this.ctx.requestRepo.findById(input.id);
    if (!reqRow) {
      return err({ message: "Request not found", status: 404 });
    }
    if (reqRow.status !== "pending" && reqRow.status !== "in_progress") {
      return err({ message: "Request is not awaiting fulfilment", status: 400 });
    }

    const lotId = reqRow.lotId;

    try {
      await this.ctx.transactionRunner.runInTransaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(lot)
          .where(and(eq(lot.id, lotId), lotNotDeleted()))
          .limit(1);
        if (!current) {
          throw new Error("Lot not found");
        }
        if (current.status === "cancelled") {
          throw Object.assign(new Error("Lot is cancelled"), { status: 400 });
        }
        const nextMd = mergeLotMarketingDetailsPatch(
          (current.marketingDetails ?? {}) as Lot["marketingDetails"],
          { conditionReport: input.conditionReport },
        );
        await tx
          .update(lot)
          .set({ marketingDetails: nextMd as Lot["marketingDetails"], updatedAt: new Date() })
          .where(eq(lot.id, lotId));

        await this.ctx.requestRepo.updateById(
          input.id,
          {
            status: "fulfilled",
            responseNote: input.responseNote ?? null,
            responseAttachmentUploadId: input.responseAttachmentUploadId ?? null,
            fulfilledByUserId: input.fulfilledByUserId,
            fulfilledAt: new Date(),
          },
          tx,
        );

        if (this.ctx.domainEventSink) {
          await this.ctx.domainEventSink.withTx(tx).publish({
            aggregateType: "lot",
            aggregateId: lotId,
            eventType: "condition_report.fulfilled",
            payload: {
              requestId: input.id,
              fulfilledByUserId: input.fulfilledByUserId,
            },
            actorUserId: input.fulfilledByUserId,
          });
        }
      });

      const refreshed = await this.ctx.lotRepo.findById(lotId);
      if (!refreshed) {
        return err({ message: "Lot not found after update", status: 500 });
      }
      await this.notifyBuyerBestEffort(
        reqRow.requestedByUserId,
        this.ctx.notificationFactory.createConditionReportReady(
          refreshed,
          reqRow.requestedByUserId,
        ),
      );
      return ok(refreshed);
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      const message = e instanceof Error ? e.message : "Fulfilment failed";
      return err({ message, status });
    }
  }

  async decline(input: {
    id: string;
    fulfilledByUserId: string;
    responseNote?: string | undefined;
  }): Promise<Result<void, ConditionReportServiceError>> {
    const reqRow = await this.ctx.requestRepo.findById(input.id);
    if (!reqRow) {
      return err({ message: "Request not found", status: 404 });
    }
    if (reqRow.status !== "pending" && reqRow.status !== "in_progress") {
      return err({ message: "Request is not awaiting fulfilment", status: 400 });
    }

    await this.ctx.transactionRunner.runInTransaction(async (tx) => {
      await this.ctx.requestRepo.updateById(
        input.id,
        {
          status: "declined",
          responseNote: input.responseNote ?? null,
          fulfilledByUserId: input.fulfilledByUserId,
          fulfilledAt: new Date(),
        },
        tx,
      );

      if (this.ctx.domainEventSink) {
        await this.ctx.domainEventSink.withTx(tx).publish({
          aggregateType: "lot",
          aggregateId: reqRow.lotId,
          eventType: "condition_report.declined",
          payload: {
            requestId: input.id,
            declinedByUserId: input.fulfilledByUserId,
          },
          actorUserId: input.fulfilledByUserId,
        });
      }
    });

    const lotRow = await this.ctx.lotRepo.findById(reqRow.lotId);
    if (lotRow) {
      await this.notifyBuyerBestEffort(
        reqRow.requestedByUserId,
        this.ctx.notificationFactory.createConditionReportDeclined(
          lotRow,
          reqRow.requestedByUserId,
          input.responseNote ?? null,
        ),
      );
    }

    return ok(undefined);
  }
}
