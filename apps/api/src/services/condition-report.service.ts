import type { Database } from "@auction/db";
import { conditionReportRequest, lot, user } from "@auction/db/schema";
import type { Lot } from "@auction/types";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";
import { mergeLotMarketingDetailsPatch } from "../lib/lot-marketing-details-merge.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type {
  ConditionReportRequestListRow,
  ConditionReportRequestRow,
  ConditionReportServiceError,
  FulfillConditionReportInput,
  IConditionReportService,
} from "./interfaces/condition-report.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { ILotRepository } from "./interfaces/repositories.js";

const OPEN_LOT_STATUSES = new Set<Lot["status"]>(["scheduled", "active"]);

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
  ) {}

  async createRequest(input: {
    userId: string;
    lotId: string;
    requestingLegalEntityId?: string | undefined;
    requestNote?: string | undefined;
  }): Promise<Result<ConditionReportRequestRow, ConditionReportServiceError>> {
    const [lotRow] = await this.db.select().from(lot).where(eq(lot.id, input.lotId)).limit(1);
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
        const [current] = await tx.select().from(lot).where(eq(lot.id, lotId)).limit(1);
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

    return ok(undefined);
  }
}
