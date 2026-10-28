import type { Database } from "@auction/db";
import { itemSubmission, lot } from "@auction/db/schema";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import type {
  ConsignmentReadScope,
  ConsignmentStatusCounts,
  IConsignmentStatusCountsReader,
} from "../interfaces/index.js";
import { consignedLotsWhere } from "./organisation-dashboard.sql.js";
import { submissionSenderSql } from "./submission-sender.sql.js";

/**
 * Counts an organisation's consignments in two grouped reads: submissions that have no lot yet,
 * and lots by status and outcome. A submission whose lot exists is counted through the lot.
 */
export class DrizzleConsignmentStatusCountsReader implements IConsignmentStatusCountsReader {
  constructor(private readonly db: Database) {}

  async count(scope: ConsignmentReadScope): Promise<ConsignmentStatusCounts> {
    const sold = sql<boolean>`${lot.winnerId} is not null`;
    const [submissions, lots] = await Promise.all([
      this.db
        .select({ status: itemSubmission.status, count: count() })
        .from(itemSubmission)
        .leftJoin(lot, and(eq(lot.id, itemSubmission.convertedLotId), isNull(lot.deletedAt)))
        .where(
          and(
            eq(itemSubmission.legalEntityId, scope.legalEntityId),
            submissionSenderSql(scope.visibleTo),
            isNull(lot.id),
          ),
        )
        .groupBy(itemSubmission.status),
      this.db
        .select({ status: lot.status, sold, count: count() })
        .from(lot)
        .where(consignedLotsWhere(scope))
        .groupBy(lot.status, sold),
    ]);
    return {
      submissions: submissions.map((row) => ({ status: row.status, count: Number(row.count) })),
      lots: lots.map((row) => ({
        status: row.status,
        sold: Boolean(row.sold),
        count: Number(row.count),
      })),
    };
  }
}
