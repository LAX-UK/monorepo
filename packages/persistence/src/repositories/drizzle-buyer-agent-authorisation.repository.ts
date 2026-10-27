import type { Database } from "@auction/db";
import { bidIdentityDirectory, buyerAgentAuthorisation, sale } from "@auction/db/schema";
import { type SQL, and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  BuyerAgentAuthorisationRecord,
  IBuyerAgentAuthorisationDirectory,
  IBuyerAgentAuthorisationWriter,
  NewBuyerAgentAuthorisation,
} from "../interfaces/buyer-agent-authorisation.repository.js";

const member = alias(bidIdentityDirectory, "baa_member");
const grantor = alias(bidIdentityDirectory, "baa_grantor");

/** How many revoked authorisations an organisation's history keeps on screen. */
const REVOKED_HISTORY_LIMIT = 20;

export class DrizzleBuyerAgentAuthorisationRepository
  implements IBuyerAgentAuthorisationDirectory, IBuyerAgentAuthorisationWriter
{
  constructor(private readonly db: Database) {}

  private select(where: SQL | undefined) {
    return this.db
      .select({
        row: buyerAgentAuthorisation,
        userName: sql<string>`coalesce(${member.name}, 'Deleted user')`,
        userEmail: sql<string>`coalesce(${member.email}, '')`,
        saleTitle: sale.title,
        createdByName: grantor.name,
      })
      .from(buyerAgentAuthorisation)
      .leftJoin(member, eq(member.subjectId, buyerAgentAuthorisation.userId))
      .leftJoin(grantor, eq(grantor.subjectId, buyerAgentAuthorisation.createdByUserId))
      .leftJoin(sale, eq(sale.id, buyerAgentAuthorisation.saleId))
      .where(where);
  }

  async listForLegalEntity(legalEntityId: string): Promise<BuyerAgentAuthorisationRecord[]> {
    const byEntity = eq(buyerAgentAuthorisation.legalEntityId, legalEntityId);
    const [active, revoked] = await Promise.all([
      this.select(and(byEntity, eq(buyerAgentAuthorisation.status, "active"))).orderBy(
        asc(member.name),
        desc(buyerAgentAuthorisation.createdAt),
      ),
      this.select(and(byEntity, eq(buyerAgentAuthorisation.status, "revoked")))
        .orderBy(desc(buyerAgentAuthorisation.revokedAt))
        .limit(REVOKED_HISTORY_LIMIT),
    ]);
    return [...active, ...revoked].map(toRecord);
  }

  async findForLegalEntity(
    legalEntityId: string,
    authorisationId: string,
  ): Promise<BuyerAgentAuthorisationRecord | null> {
    const [row] = await this.select(
      and(
        eq(buyerAgentAuthorisation.legalEntityId, legalEntityId),
        eq(buyerAgentAuthorisation.id, authorisationId),
      ),
    ).limit(1);
    return row ? toRecord(row) : null;
  }

  grant(
    input: NewBuyerAgentAuthorisation,
    supersededReason: string,
  ): Promise<{ id: string; supersededId: string | null }> {
    return this.db.transaction(async (tx) => {
      const sameScope = input.saleId
        ? eq(buyerAgentAuthorisation.saleId, input.saleId)
        : isNull(buyerAgentAuthorisation.saleId);
      const [superseded] = await tx
        .update(buyerAgentAuthorisation)
        .set({ status: "revoked", revokedAt: new Date(), revokedReason: supersededReason })
        .where(
          and(
            eq(buyerAgentAuthorisation.legalEntityId, input.legalEntityId),
            eq(buyerAgentAuthorisation.userId, input.userId),
            eq(buyerAgentAuthorisation.status, "active"),
            sameScope,
          ),
        )
        .returning({ id: buyerAgentAuthorisation.id });
      const [created] = await tx
        .insert(buyerAgentAuthorisation)
        .values({
          legalEntityId: input.legalEntityId,
          userId: input.userId,
          saleId: input.saleId,
          bidLimit: input.bidLimit,
          validFrom: input.validFrom,
          validUntil: input.validUntil,
          createdByUserId: input.createdByUserId,
        })
        .returning({ id: buyerAgentAuthorisation.id });
      if (!created) throw new Error("buyer_agent_authorisation_insert_failed");
      return { id: created.id, supersededId: superseded?.id ?? null };
    });
  }

  async revoke(input: {
    legalEntityId: string;
    authorisationId: string;
    reason: string;
    revokedAt: Date;
  }): Promise<boolean> {
    const rows = await this.db
      .update(buyerAgentAuthorisation)
      .set({ status: "revoked", revokedAt: input.revokedAt, revokedReason: input.reason })
      .where(
        and(
          eq(buyerAgentAuthorisation.id, input.authorisationId),
          eq(buyerAgentAuthorisation.legalEntityId, input.legalEntityId),
          eq(buyerAgentAuthorisation.status, "active"),
        ),
      )
      .returning({ id: buyerAgentAuthorisation.id });
    return rows.length > 0;
  }
}

type SelectedRow = {
  row: typeof buyerAgentAuthorisation.$inferSelect;
  userName: string;
  userEmail: string;
  saleTitle: string | null;
  createdByName: string | null;
};

function toRecord({
  row,
  userName,
  userEmail,
  saleTitle,
  createdByName,
}: SelectedRow): BuyerAgentAuthorisationRecord {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    userId: row.userId,
    userName,
    userEmail,
    saleId: row.saleId,
    saleTitle,
    bidLimit: row.bidLimit != null ? String(row.bidLimit) : null,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
    status: row.status,
    createdByUserId: row.createdByUserId,
    createdByName,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
    revokedReason: row.revokedReason,
  };
}
