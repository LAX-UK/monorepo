import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import {
  artistProfile,
  bid,
  bidIdentityDirectory,
  itemSubmission,
  legalEntityMember,
  lot,
  payment,
  paymentExternalRef,
  sale,
} from "@auction/db/schema";
import type { AccountSearchTerms } from "@auction/domain";
import { type SQL, and, asc, desc, eq, ilike, inArray, isNotNull, isNull, or } from "drizzle-orm";
import type {
  AccountSearchCriteria,
  ConsignmentSearchHit,
  IAccountRecordSearchReader,
  InvoiceSearchHit,
  LotSearchHit,
  MemberSearchHit,
} from "../interfaces/account-record-search.reader.js";
import { escapeLikePattern } from "./audit-log-sql.js";
import { lotCurrencySql } from "./organisation-dashboard.sql.js";
import { submissionSenderSql } from "./submission-sender.sql.js";

const contains = (terms: AccountSearchTerms) => `%${escapeLikePattern(terms.text)}%`;

/** A lot matches on its title, its artist's name or its lot number. */
function lotMatches(terms: AccountSearchTerms): SQL | undefined {
  const pattern = contains(terms);
  return or(
    ilike(lot.title, pattern),
    ilike(artistProfile.displayName, pattern),
    terms.lotNumber !== null ? eq(lot.lotNumber, terms.lotNumber) : undefined,
  );
}

const LOT_COLUMNS = {
  lotId: lot.id,
  title: lot.title,
  artistName: artistProfile.displayName,
  lotNumber: lot.lotNumber,
  saleId: lot.saleId,
  saleTitle: sale.title,
  lotStatus: lot.status,
  endsAt: lot.endTime,
};

type Page = Pick<AccountSearchCriteria<unknown>, "limit" | "offset">;

/**
 * Searches one account's records, each group over its own indexed access path (the account's
 * consignments, wins, bids, payments or members) and only then by text, so the cost follows the
 * size of the account, not of the platform.
 */
export class DrizzleAccountRecordSearchReader implements IAccountRecordSearchReader {
  constructor(private readonly db: Database) {}

  consignments = async (
    criteria: AccountSearchCriteria<"all" | "attributed" | "own">,
  ): Promise<ConsignmentSearchHit[]> => {
    const { terms } = criteria;
    const rows = await this.db
      .select({
        submissionId: itemSubmission.id,
        title: itemSubmission.title,
        status: itemSubmission.status,
        updatedAt: itemSubmission.updatedAt,
        lot: LOT_COLUMNS,
      })
      .from(itemSubmission)
      .leftJoin(lot, and(eq(lot.id, itemSubmission.convertedLotId), lotNotDeleted()))
      .leftJoin(artistProfile, eq(artistProfile.id, lot.artistId))
      .leftJoin(sale, eq(sale.id, lot.saleId))
      .where(
        and(
          eq(itemSubmission.legalEntityId, criteria.legalEntityId),
          submissionSenderSql({ scope: criteria.scope, userId: criteria.userId }),
          or(ilike(itemSubmission.title, contains(terms)), lotMatches(terms)),
        ),
      )
      .orderBy(desc(itemSubmission.updatedAt), asc(itemSubmission.id))
      .limit(criteria.limit)
      .offset(criteria.offset);
    return rows.map((row) => ({
      submissionId: row.submissionId,
      title: row.title,
      status: row.status,
      updatedAt: row.updatedAt,
      // A lot's status is never null, so a null one means no lot was joined.
      lot:
        row.lot.lotId && row.lot.lotStatus
          ? {
              lotId: row.lot.lotId,
              artistName: row.lot.artistName,
              lotNumber: row.lot.lotNumber,
              saleId: row.lot.saleId,
              saleTitle: row.lot.saleTitle,
              lotStatus: row.lot.lotStatus,
            }
          : null,
    }));
  };

  purchases = (criteria: AccountSearchCriteria<"all" | "own">) =>
    this.wonLots(criteria, criteria.scope === "own" ? criteria.userId : null);

  works = (criteria: AccountSearchCriteria<"all">) => this.wonLots(criteria, null);

  bids = async (criteria: AccountSearchCriteria<"all" | "own">): Promise<LotSearchHit[]> => {
    const placedFor = and(
      eq(bid.buyerLegalEntityId, criteria.legalEntityId),
      criteria.scope === "own" ? eq(bid.bidderId, criteria.userId) : undefined,
    );
    return this.lots(
      and(
        inArray(lot.id, this.db.selectDistinct({ id: bid.lotId }).from(bid).where(placedFor)),
        lotNotDeleted(),
        lotMatches(criteria.terms),
      ),
      criteria,
    );
  };

  invoices = async (criteria: AccountSearchCriteria<"all">): Promise<InvoiceSearchHit[]> => {
    const pattern = contains(criteria.terms);
    const rows = await this.db
      .select({
        paymentId: payment.id,
        invoiceNumber: paymentExternalRef.xeroInvoiceNumber,
        lotId: lot.id,
        title: lot.title,
        amount: payment.amount,
        currency: lotCurrencySql,
        status: payment.status,
        createdAt: payment.createdAt,
      })
      .from(payment)
      .innerJoin(paymentExternalRef, eq(paymentExternalRef.paymentId, payment.id))
      .innerJoin(lot, eq(lot.id, payment.lotId))
      .where(
        and(
          eq(payment.buyerLegalEntityId, criteria.legalEntityId),
          isNotNull(paymentExternalRef.xeroInvoiceNumber),
          or(ilike(paymentExternalRef.xeroInvoiceNumber, pattern), ilike(lot.title, pattern)),
        ),
      )
      .orderBy(desc(payment.createdAt), asc(payment.id))
      .limit(criteria.limit)
      .offset(criteria.offset);
    return rows.map((row) => ({ ...row, invoiceNumber: row.invoiceNumber ?? "" }));
  };

  members = async (criteria: AccountSearchCriteria<"all">): Promise<MemberSearchHit[]> => {
    const pattern = contains(criteria.terms);
    return this.db
      .select({
        memberId: legalEntityMember.id,
        userId: legalEntityMember.userId,
        name: bidIdentityDirectory.name,
        email: bidIdentityDirectory.email,
        role: legalEntityMember.role,
      })
      .from(legalEntityMember)
      .innerJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, legalEntityMember.userId))
      .where(
        and(
          eq(legalEntityMember.legalEntityId, criteria.legalEntityId),
          isNull(legalEntityMember.removedAt),
          or(ilike(bidIdentityDirectory.name, pattern), ilike(bidIdentityDirectory.email, pattern)),
        ),
      )
      .orderBy(asc(bidIdentityDirectory.name), asc(legalEntityMember.id))
      .limit(criteria.limit)
      .offset(criteria.offset);
  };

  /** Lots won for the account; `winnerId` narrows them to one member's wins. */
  private wonLots(
    criteria: AccountSearchCriteria<unknown>,
    winnerId: string | null,
  ): Promise<LotSearchHit[]> {
    return this.lots(
      and(
        eq(lot.buyerLegalEntityId, criteria.legalEntityId),
        eq(lot.status, "ended"),
        winnerId ? eq(lot.winnerId, winnerId) : isNotNull(lot.winnerId),
        lotNotDeleted(),
        lotMatches(criteria.terms),
      ),
      criteria,
    );
  }

  private async lots(where: SQL | undefined, page: Page): Promise<LotSearchHit[]> {
    return this.db
      .select(LOT_COLUMNS)
      .from(lot)
      .leftJoin(artistProfile, eq(artistProfile.id, lot.artistId))
      .leftJoin(sale, eq(sale.id, lot.saleId))
      .where(where)
      .orderBy(desc(lot.endTime), asc(lot.id))
      .limit(page.limit)
      .offset(page.offset);
  }
}
