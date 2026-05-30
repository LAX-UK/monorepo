import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { conditionReportRequest, lot, user } from "@auction/db/schema";
import type { Lot } from "@auction/types";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";
import { mergeLotMarketingDetailsPatch } from "../lib/lot-marketing-details-merge.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type {
  BuyerConditionReportListRow,
  ConditionReportRequestListRow,
  ConditionReportRequestRow,
  ConditionReportServiceError,
  FulfillConditionReportInput,
  IConditionReportService,
} from "./interfaces/condition-report.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { ILotRepository } from "./interfaces/repositories.js";
import { notificationRowToPayload } from "./notification-payload.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import type { NotificationFactory } from "./notification.factory.js";

const OPEN_LOT_STATUSES = new Set<Lot["status"]>(["scheduled", "active"]);
const OPEN_REQUEST_STATUSES = ["pending", "in_progress"] as const;

function extractConditionReportDownloadUrl(
  marketingDetails: Lot["marketingDetails"] | null | undefined,
): string | null {
  const cr = marketingDetails?.conditionReport;
  const url = cr?.downloadUrl;
  if (typeof url !== "string" || url.trim() === "") return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function mapRequestRow(r: typeof conditionReportRequest.$inferSelect): ConditionReportRequestRow {
  return {
    id: r.id,
    lotId: r.lotId,
    requestedByUserId: r.requestedByUserId,
    requestingLegalEntityId: r.requestingLegalEntityId,
    status: r.status as ConditionReportRequestRow["status"],
    requestNote: r.requestNote,
    responseNote: r.responseNote,
    responseAttachmentUploadId: r.responseAttachmentUploadId,
    fulfilledByUserId: r.fulfilledByUserId,
    fulfilledAt: r.fulfilledAt,
    createdAt: r.createdAt,
  };
}

export class ConditionReportService implements IConditionReportService {
  constructor(
    private readonly db: Database,
    private readonly lotRepo: ILotRepository,
    private readonly legalEntityRepository: ILegalEntityRepository | null,
    private readonly domainEventPublisher: DomainEventPublisher | null,
    private readonly notificationDispatcher: NotificationDispatcher | null,
    private readonly notificationFactory: NotificationFactory,
  ) {}

  private async notifyBuyerBestEffort(
    userId: string,
    payload: ReturnType<NotificationFactory["createConditionReportReady"]>,
  ): Promise<void> {
    if (!this.notificationDispatcher) return;
    try {
      await this.notificationDispatcher.dispatch(userId, notificationRowToPayload(payload));
    } catch {
      /* notification must not fail fulfilment */
    }
  }

  async createRequest(input: {
    userId: string;
    lotId: string;
    requestingLegalEntityId?: string | undefined;
    requestNote?: string | undefined;
  }): Promise<Result<ConditionReportRequestRow, ConditionReportServiceError>> {
    const [lotRow] = await this.db
      .select()
      .from(lot)
      .where(and(eq(lot.id, input.lotId), lotNotDeleted()))
      .limit(1);
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
      if (!this.legalEntityRepository) {
        return err({ message: "Legal entity context is not configured", status: 503 });
      }
      const mem = await this.legalEntityRepository.findActiveMembership(
        input.userId,
        input.requestingLegalEntityId,
      );
      if (!mem) {
        return err({ message: "Not a member of the selected legal entity", status: 403 });
      }
    }

    const [existing] = await this.db
      .select()
      .from(conditionReportRequest)
      .where(
        and(
          eq(conditionReportRequest.lotId, input.lotId),
          eq(conditionReportRequest.requestedByUserId, input.userId),
          inArray(conditionReportRequest.status, ["pending", "in_progress"]),
        ),
      )
      .limit(1);
    if (existing) {
      return ok(mapRequestRow(existing));
    }

    const [priorRequest] = await this.db
      .select()
      .from(conditionReportRequest)
      .where(
        and(
          eq(conditionReportRequest.lotId, input.lotId),
          eq(conditionReportRequest.requestedByUserId, input.userId),
        ),
      )
      .limit(1);
    if (priorRequest) {
      return err({
        message: "You have already requested a condition report for this lot",
        status: 409,
        code: "condition_report_already_requested",
      });
    }

    const [inserted] = await this.db
      .insert(conditionReportRequest)
      .values({
        lotId: input.lotId,
        requestedByUserId: input.userId,
        requestingLegalEntityId: input.requestingLegalEntityId ?? null,
        requestNote: input.requestNote ?? null,
        status: "pending",
      })
      .returning();

    if (!inserted) {
      return err({ message: "Could not create condition report request", status: 500 });
    }
    const row = mapRequestRow(inserted);
    if (this.domainEventPublisher) {
      await this.domainEventPublisher.publish(this.db, {
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
  }

  async listForAdmin(input: {
    status?: "pending" | "in_progress" | "fulfilled" | "declined" | undefined;
    lotId?: string | undefined;
    limit: number;
    offset: number;
  }): Promise<{ items: ConditionReportRequestListRow[]; total: number }> {
    const filters = [] as ReturnType<typeof eq>[];
    if (input.status) {
      filters.push(eq(conditionReportRequest.status, input.status));
    }
    if (input.lotId) {
      filters.push(eq(conditionReportRequest.lotId, input.lotId));
    }
    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const countBase = this.db.select({ n: count() }).from(conditionReportRequest);
    const [totalRow] = whereClause ? await countBase.where(whereClause) : await countBase;
    const total = Number(totalRow?.n ?? 0);

    const listBase = this.db
      .select({
        r: conditionReportRequest,
        lotTitle: lot.title,
        requesterEmail: user.email,
      })
      .from(conditionReportRequest)
      .innerJoin(lot, eq(lot.id, conditionReportRequest.lotId))
      .leftJoin(user, eq(user.id, conditionReportRequest.requestedByUserId))
      .orderBy(desc(conditionReportRequest.createdAt))
      .limit(input.limit)
      .offset(input.offset);
    const rows = whereClause ? await listBase.where(whereClause) : await listBase;

    const items: ConditionReportRequestListRow[] = rows.map(({ r, lotTitle, requesterEmail }) => ({
      ...mapRequestRow(r),
      lotTitle,
      requesterEmail,
    }));

    return { items, total };
  }

  async findForBuyerOnLot(input: {
    userId: string;
    lotId: string;
  }): Promise<ConditionReportRequestRow | null> {
    const rows = await this.db
      .select()
      .from(conditionReportRequest)
      .where(
        and(
          eq(conditionReportRequest.lotId, input.lotId),
          eq(conditionReportRequest.requestedByUserId, input.userId),
        ),
      )
      .orderBy(desc(conditionReportRequest.createdAt));

    if (rows.length === 0) return null;

    const open = rows.find((r) => (OPEN_REQUEST_STATUSES as readonly string[]).includes(r.status));
    const chosen = open ?? rows[0];
    if (!chosen) return null;
    return mapRequestRow(chosen);
  }

  async listForBuyer(input: {
    userId: string;
    limit: number;
    offset: number;
  }): Promise<{ items: BuyerConditionReportListRow[]; total: number }> {
    const whereClause = eq(conditionReportRequest.requestedByUserId, input.userId);

    const [totalRow] = await this.db
      .select({ n: count() })
      .from(conditionReportRequest)
      .where(whereClause);
    const total = Number(totalRow?.n ?? 0);

    const rows = await this.db
      .select({
        r: conditionReportRequest,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        marketingDetails: lot.marketingDetails,
      })
      .from(conditionReportRequest)
      .innerJoin(lot, eq(lot.id, conditionReportRequest.lotId))
      .where(whereClause)
      .orderBy(desc(conditionReportRequest.createdAt))
      .limit(input.limit)
      .offset(input.offset);

    const items: BuyerConditionReportListRow[] = rows.map(
      ({ r, lotTitle, lotNumber, marketingDetails }) => {
        const base = mapRequestRow(r);
        const downloadUrl =
          base.status === "fulfilled"
            ? extractConditionReportDownloadUrl(marketingDetails as Lot["marketingDetails"])
            : null;
        return {
          ...base,
          lotTitle: lotTitle ?? "Lot",
          lotNumber,
          downloadUrl,
        };
      },
    );

    return { items, total };
  }

  async fulfill(
    input: FulfillConditionReportInput,
  ): Promise<Result<Lot, ConditionReportServiceError>> {
    const [reqRow] = await this.db
      .select()
      .from(conditionReportRequest)
      .where(eq(conditionReportRequest.id, input.id))
      .limit(1);
    if (!reqRow) {
      return err({ message: "Request not found", status: 404 });
    }
    if (reqRow.status !== "pending" && reqRow.status !== "in_progress") {
      return err({ message: "Request is not awaiting fulfilment", status: 400 });
    }

    const lotId = reqRow.lotId;

    try {
      await this.db.transaction(async (tx) => {
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

        await tx
          .update(conditionReportRequest)
          .set({
            status: "fulfilled",
            responseNote: input.responseNote ?? null,
            responseAttachmentUploadId: input.responseAttachmentUploadId ?? null,
            fulfilledByUserId: input.fulfilledByUserId,
            fulfilledAt: new Date(),
          })
          .where(eq(conditionReportRequest.id, input.id));

        if (this.domainEventPublisher) {
          await this.domainEventPublisher.publish(tx, {
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

      const refreshed = await this.lotRepo.findById(lotId);
      if (!refreshed) {
        return err({ message: "Lot not found after update", status: 500 });
      }
      await this.notifyBuyerBestEffort(
        reqRow.requestedByUserId,
        this.notificationFactory.createConditionReportReady(refreshed, reqRow.requestedByUserId),
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
    const [reqRow] = await this.db
      .select()
      .from(conditionReportRequest)
      .where(eq(conditionReportRequest.id, input.id))
      .limit(1);
    if (!reqRow) {
      return err({ message: "Request not found", status: 404 });
    }
    if (reqRow.status !== "pending" && reqRow.status !== "in_progress") {
      return err({ message: "Request is not awaiting fulfilment", status: 400 });
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(conditionReportRequest)
        .set({
          status: "declined",
          responseNote: input.responseNote ?? null,
          fulfilledByUserId: input.fulfilledByUserId,
          fulfilledAt: new Date(),
        })
        .where(eq(conditionReportRequest.id, input.id));

      if (this.domainEventPublisher) {
        await this.domainEventPublisher.publish(tx, {
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

    const lotRow = await this.lotRepo.findById(reqRow.lotId);
    if (lotRow) {
      await this.notifyBuyerBestEffort(
        reqRow.requestedByUserId,
        this.notificationFactory.createConditionReportDeclined(
          lotRow,
          reqRow.requestedByUserId,
          input.responseNote ?? null,
        ),
      );
    }

    return ok(undefined);
  }
}
