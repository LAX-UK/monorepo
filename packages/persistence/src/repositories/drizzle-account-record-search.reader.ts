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
import { bidOutcome, purchaseInvoiceState } from "@auction/domain";
import type { PaymentStatus } from "@auction/types";
import {
  type SQL,
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { type AnyPgColumn, alias } from "drizzle-orm/pg-core";
import type {
  AccountSearchCriteria,
  BidSearchHit,
  ConsignmentSearchHit,
  IAccountRecordSearchReader,
  InvoiceSearchHit,
  LotSearchHit,
  MemberSearchHit,
  PurchaseSearchHit,
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

  purchases = async (
    criteria: AccountSearchCriteria<"all" | "own">,
  ): Promise<PurchaseSearchHit[]> => {
    // The lot's latest payment billed to the account: its state and when the invoice was raised.
    const latest = (column: SQL | AnyPgColumn) => sql`(
      select ${column} from ${payment}
      where ${payment.lotId} = ${lot.id} and ${payment.buyerLegalEntityId} = ${criteria.legalEntityId}
      order by ${payment.createdAt} desc limit 1
    )`;
    const rows = await this.lots(
      this.wonLotsWhere(criteria, criteria.scope === "own" ? criteria.userId : null),
      criteria,
      {
        hammerPrice: lot.currentPrice,
        currency: lotCurrencySql,
        paymentStatus: latest(payment.status).mapWith(String) as SQL<PaymentStatus | null>,
        invoicedAt: latest(payment.createdAt).mapWith((value) =>
          value == null ? null : new Date(value),
        ) as SQL<Date | null>,
      },
    );
    return rows.map(({ paymentStatus, invoicedAt, ...row }) => ({
      ...row,
      paymentState: purchaseInvoiceState(
        {
          payment:
            paymentStatus && invoicedAt ? { status: paymentStatus, raisedAt: invoicedAt } : null,
        },
        criteria.now,
      ).status,
    }));
  };

  works = (criteria: AccountSearchCriteria<"all">): Promise<LotSearchHit[]> =>
    this.lots(this.wonLotsWhere(criteria, null), criteria, {});

  bids = async (criteria: AccountSearchCriteria<"all" | "own">): Promise<BidSearchHit[]> => {
    const own = criteria.scope === "own";
    // The bids in scope: the account's, or one member's for it.
    const placedFor = (table: { buyerLegalEntityId: AnyPgColumn; bidderId: AnyPgColumn }) =>
      and(
        eq(table.buyerLegalEntityId, criteria.legalEntityId),
        own ? eq(table.bidderId, criteria.userId) : undefined,
      );
    const mine = alias(bid, "mine");
    const rows = await this.lots(
      and(
        inArray(lot.id, this.db.selectDistinct({ id: bid.lotId }).from(bid).where(placedFor(bid))),
        lotNotDeleted(),
        lotMatches(criteria.terms),
      ),
      criteria,
      {
        currency: lotCurrencySql,
        maximum: sql<string | null>`(${this.db
          .select({
            value: sql`max(greatest(${mine.amount}, coalesce(${mine.maxAutoBidAmount}, ${mine.amount})))::text`,
          })
          .from(mine)
          .where(and(eq(mine.lotId, lot.id), placedFor(mine)))})`,
        leading: sql<boolean>`exists (${this.db
          .select({ one: sql`1` })
          .from(mine)
          .where(and(eq(mine.lotId, lot.id), eq(mine.isWinning, true), placedFor(mine)))})`,
        won: sql<boolean>`(${and(
          eq(lot.buyerLegalEntityId, criteria.legalEntityId),
          own ? eq(lot.winnerId, criteria.userId) : isNotNull(lot.winnerId),
        )})`,
      },
    );
    return rows.map(({ leading, won, ...row }) => ({
      ...row,
      outcome: bidOutcome({
        lotStatus: row.lotStatus,
        leading: Boolean(leading),
        won: Boolean(won),
      }),
    }));
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
  private wonLotsWhere(
    criteria: AccountSearchCriteria<unknown>,
    winnerId: string | null,
  ): SQL | undefined {
    return and(
      eq(lot.buyerLegalEntityId, criteria.legalEntityId),
      eq(lot.status, "ended"),
      winnerId ? eq(lot.winnerId, winnerId) : isNotNull(lot.winnerId),
      lotNotDeleted(),
      lotMatches(criteria.terms),
    );
  }

  /** One page of lots with their common columns, plus what a group adds to each. */
  private lots<E extends Record<string, SQL | SQL.Aliased | AnyPgColumn>>(
    where: SQL | undefined,
    page: Page,
    extra: E,
  ) {
    return this.db
      .select({ ...LOT_COLUMNS, ...extra })
      .from(lot)
      .leftJoin(artistProfile, eq(artistProfile.id, lot.artistId))
      .leftJoin(sale, eq(sale.id, lot.saleId))
      .where(where)
      .orderBy(desc(lot.endTime), asc(lot.id))
      .limit(page.limit)
      .offset(page.offset);
  }
}
