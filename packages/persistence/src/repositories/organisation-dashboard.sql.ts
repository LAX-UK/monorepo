import { itemSubmission, lot } from "@auction/db/schema";
import { type SQL, and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { ConsignmentReadScope } from "../interfaces/index.js";
import { submissionSenderSql } from "./submission-sender.sql.js";

/** A lot's currency: its estimate's, else pounds (the same rule the catalogue shows). */
export const lotCurrencySql = sql<string>`coalesce(nullif(upper(${lot.marketingDetails}->'estimate'->>'currency'), ''), 'GBP')`;

/** One end of a lot's estimate as a number, or `null` when it is missing or not a number. */
export function lotEstimateSql(end: "low" | "high"): SQL<string | null> {
  const raw = sql`${lot.marketingDetails}->'estimate'->>${sql.raw(`'${end}'`)}`;
  return sql<string | null>`case when ${raw} ~ '^[0-9]+(\\.[0-9]+)?$' then (${raw})::numeric end`;
}

/**
 * The organisation's lots a member may see. Members who see every consignment see every lot the
 * organisation sells; the others see the lots made from the submissions they may see.
 */
export function consignedLotsWhere(scope: ConsignmentReadScope): SQL | undefined {
  const sender = submissionSenderSql(scope.visibleTo);
  return and(
    eq(lot.sellerLegalEntityId, scope.legalEntityId),
    isNull(lot.deletedAt),
    sender
      ? inArray(
          lot.id,
          sql`(select ${itemSubmission.convertedLotId} from ${itemSubmission} where ${and(
            eq(itemSubmission.legalEntityId, scope.legalEntityId),
            isNotNull(itemSubmission.convertedLotId),
            sender,
          )})`,
        )
      : undefined,
  );
}
