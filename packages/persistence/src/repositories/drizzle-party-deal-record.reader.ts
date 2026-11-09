import type { Database } from "@auction/db";
import type { PartyDealRecord } from "@auction/domain";
import type { PrivateSaleDealStage } from "@auction/types";
import { type SQL, sql } from "drizzle-orm";
import type { IPartyDealRecordReader } from "../interfaces/party-deal-record.reader.js";

type DealRow = {
  reference: string;
  stage: string;
  agreed_at: Date | string | null;
  cancelled_at: Date | string | null;
  /** When the deal settled, from its stage history; null if no row says so. */
  settled_at: Date | string | null;
  updated_at: Date | string;
  last_change_at: Date | string | null;
  /** When checks started to count for the deal: the enquiry's date, or the deal's own. */
  since: Date | string;
};

const toDate = (value: Date | string): Date => (value instanceof Date ? value : new Date(value));

/**
 * Every private sale deal a person or an organisation is, or was ever named as, a party to, in the
 * shape the retention rules read. A party who was replaced before agreement is found through the
 * party history, which also holds an organisation named before any person acted for it.
 */
export class DrizzlePartyDealRecordReader implements IPartyDealRecordReader {
  constructor(private readonly db: Database) {}

  async forUser(userId: string): Promise<PartyDealRecord[]> {
    const deals = await this.deals(sql`
      SELECT "deal_id" FROM "private_sale_deal_party" WHERE "acting_user_id" = ${userId}
      UNION
      SELECT "deal_id" FROM "private_sale_deal_party_history" WHERE "acting_user_id" = ${userId}
    `);
    if (deals.length === 0) return [];
    const evidence = await this.db.execute<{ at: Date | string }>(sql`
      SELECT "created_at" AS at FROM "kyc_verification" WHERE "user_id" = ${userId}
      UNION ALL
      SELECT "created_at" AS at FROM "kyc_watchlist_screening" WHERE "user_id" = ${userId}
      UNION ALL
      SELECT "created_at" AS at FROM "source_of_funds" WHERE "user_id" = ${userId}
    `);
    return recordsFrom(
      deals,
      evidence.rows.map((row) => toDate(row.at)),
    );
  }

  async forLegalEntity(legalEntityId: string): Promise<PartyDealRecord[]> {
    const deals = await this.deals(sql`
      SELECT "deal_id" FROM "private_sale_deal_party" WHERE "legal_entity_id" = ${legalEntityId}
      UNION
      SELECT "deal_id" FROM "private_sale_deal_party_history" WHERE "legal_entity_id" = ${legalEntityId}
    `);
    if (deals.length === 0) return [];
    const evidence = await this.db.execute<{ at: Date | string }>(sql`
      SELECT "uploaded_at" AS at FROM "legal_entity_document" WHERE "legal_entity_id" = ${legalEntityId}
      UNION ALL
      SELECT "reviewed_at" AS at FROM "legal_entity_document"
      WHERE "legal_entity_id" = ${legalEntityId} AND "reviewed_at" IS NOT NULL
    `);
    return recordsFrom(
      deals,
      evidence.rows.map((row) => toDate(row.at)),
    );
  }

  private async deals(dealIds: SQL): Promise<DealRow[]> {
    const result = await this.db.execute<DealRow>(sql`
      SELECT d."reference", d."stage", d."agreed_at", d."cancelled_at", d."updated_at",
        (SELECT MAX(h."created_at") FROM "private_sale_deal_stage_history" h
          WHERE h."deal_id" = d."id" AND h."to_stage" = 'settled') AS settled_at,
        (SELECT MAX(h."created_at") FROM "private_sale_deal_stage_history" h
          WHERE h."deal_id" = d."id") AS last_change_at,
        COALESCE(e."created_at", d."created_at") AS since
      FROM "private_sale_deal" d
      LEFT JOIN "marketing_enquiry" e ON e."id" = d."source_enquiry_id"
      WHERE d."id" IN (${dealIds})
      ORDER BY d."reference"
    `);
    return result.rows;
  }
}

/**
 * When a deal ended. A settled deal's end is the stage history's settle row; with no such row it is
 * the deal's last update, which is when it was written as settled, so a missing history row never
 * leaves a deal with no end.
 */
function endedAtOf(row: DealRow): Date | null {
  if (row.stage === "cancelled") return row.cancelled_at ? toDate(row.cancelled_at) : null;
  if (row.stage === "settled") return toDate(row.settled_at ?? row.updated_at);
  return null;
}

/**
 * A check counts for a deal when evidence was created for the person between the enquiry arriving
 * (staff vet the person before converting) and the deal ending, so the person's evidence from
 * before the deal, or from long after it, is not taken for the deal's own clearance.
 */
function recordsFrom(rows: readonly DealRow[], evidence: readonly Date[]): PartyDealRecord[] {
  return rows.map((row) => {
    const endedAt = endedAtOf(row);
    const since = toDate(row.since);
    return {
      reference: row.reference,
      stage: row.stage as PrivateSaleDealStage,
      agreedAt: row.agreed_at ? toDate(row.agreed_at) : null,
      endedAt,
      lastChangeAt: toDate(row.last_change_at ?? row.updated_at),
      hasComplianceCase: evidence.some((at) => at >= since && (endedAt === null || at <= endedAt)),
    };
  });
}
