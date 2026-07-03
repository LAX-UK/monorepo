import type { Database } from "@auction/db";
import { conditionReportRequest, lot, user } from "@auction/db/schema";
import type { Lot } from "@auction/types";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import {
  OPEN_REQUEST_STATUSES,
  extractConditionReportDownloadUrl,
  mapRequestRow,
} from "../services/condition-report/condition-report-request.mapper.js";
import type {
  BuyerConditionReportListRow,
  ConditionReportAdminListFilter,
  ConditionReportRequestListRow,
  IConditionReportRequestRepository,
  InsertConditionReportRequestInput,
  UpdateConditionReportRequestInput,
} from "./interfaces/condition-report-request.repository.js";

function buildAdminWhereClause(filter: ConditionReportAdminListFilter) {
  const filters = [] as ReturnType<typeof eq>[];
  if (filter.status === "open") {
    filters.push(inArray(conditionReportRequest.status, [...OPEN_REQUEST_STATUSES]));
  } else if (filter.status) {
    filters.push(eq(conditionReportRequest.status, filter.status));
  }
  if (filter.lotId) {
    filters.push(eq(conditionReportRequest.lotId, filter.lotId));
  }
  return filters.length > 0 ? and(...filters) : undefined;
}

export class DrizzleConditionReportRequestRepository implements IConditionReportRequestRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(conditionReportRequest)
      .where(eq(conditionReportRequest.id, id))
      .limit(1);
    return row ? mapRequestRow(row) : null;
  }

  async findOpenByLotAndUser(lotId: string, userId: string) {
    const [row] = await this.db
      .select()
      .from(conditionReportRequest)
      .where(
        and(
          eq(conditionReportRequest.lotId, lotId),
          eq(conditionReportRequest.requestedByUserId, userId),
          inArray(conditionReportRequest.status, [...OPEN_REQUEST_STATUSES]),
        ),
      )
      .limit(1);
    return row ? mapRequestRow(row) : null;
  }

  async findAnyByLotAndUser(lotId: string, userId: string) {
    const [row] = await this.db
      .select()
      .from(conditionReportRequest)
      .where(
        and(
          eq(conditionReportRequest.lotId, lotId),
          eq(conditionReportRequest.requestedByUserId, userId),
        ),
      )
      .limit(1);
    return row ? mapRequestRow(row) : null;
  }

  async listByLotAndUser(lotId: string, userId: string) {
    const rows = await this.db
      .select()
      .from(conditionReportRequest)
      .where(
        and(
          eq(conditionReportRequest.lotId, lotId),
          eq(conditionReportRequest.requestedByUserId, userId),
        ),
      )
      .orderBy(desc(conditionReportRequest.createdAt));
    return rows.map(mapRequestRow);
  }

  async insert(input: InsertConditionReportRequestInput) {
    const [inserted] = await this.db
      .insert(conditionReportRequest)
      .values({
        lotId: input.lotId,
        requestedByUserId: input.requestedByUserId,
        requestingLegalEntityId: input.requestingLegalEntityId ?? null,
        requestNote: input.requestNote ?? null,
        status: "pending",
      })
      .returning();
    if (!inserted) {
      throw new Error("Could not create condition report request");
    }
    return mapRequestRow(inserted);
  }

  async updateById(id: string, patch: UpdateConditionReportRequestInput, tx?: unknown) {
    const conn = (tx ?? this.db) as Database;
    const [updated] = await conn
      .update(conditionReportRequest)
      .set(patch)
      .where(eq(conditionReportRequest.id, id))
      .returning();
    return updated ? mapRequestRow(updated) : null;
  }

  async listForAdmin(filter: ConditionReportAdminListFilter) {
    const whereClause = buildAdminWhereClause(filter);

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
      .limit(filter.limit)
      .offset(filter.offset);
    const rows = whereClause ? await listBase.where(whereClause) : await listBase;

    const items: ConditionReportRequestListRow[] = rows.map(({ r, lotTitle, requesterEmail }) => ({
      ...mapRequestRow(r),
      lotTitle,
      requesterEmail,
    }));

    return { items, total };
  }

  async listForBuyer(input: { userId: string; limit: number; offset: number }) {
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
}
