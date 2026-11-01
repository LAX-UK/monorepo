import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import {
  accessRequest,
  bid,
  bidIdentityDirectory,
  bidUserProfile,
  buyerAgentAuthorisation,
  consignmentAgreement,
  consignmentMessage,
  consignmentThread,
  deliveryQuote,
  itemSubmission,
  lot,
  lotFulfilment,
  payment,
  sourceOfFunds,
  userInvitation,
} from "@auction/db/schema";
import type {
  EndingAuthorisation,
  ExpiredInvitation,
  HomeSubject,
  PendingAccessRequest,
  PurchaseNextStepFacts,
  UnreadReply,
} from "@auction/domain";
import type { PaymentStatus } from "@auction/types";
import {
  type SQL,
  and,
  asc,
  desc,
  eq,
  exists,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { SubmissionSenderFilter } from "../interfaces/item-submission.repository.js";
import type { INeedsYouFactsReader } from "../interfaces/needs-you-facts.reader.js";
import { submissionSenderSql } from "./submission-sender.sql.js";

/** Submission states whose consignment checklist is open (as `computeConsignmentChecklist`). */
const OPEN_CONSIGNMENT = [
  "submitted",
  "under_review",
  "changes_requested",
  "approved",
  "converted",
] as const;

/** Payment states that leave a won lot still to pay (as `purchaseNextStep`). */
const TO_PAY: PaymentStatus[] = ["pending", "cancelled", "requires_manual_review"];

const KYC_IDENTITY = { approved: "verified", pending: "checking" } as const;

/**
 * One bounded read per "Needs you" fact. Every read starts from the account's own indexed rows
 * (its bids, wins, submissions, invitations or authorisations).
 */
export class DrizzleNeedsYouFactsReader implements INeedsYouFactsReader {
  constructor(private readonly db: Database) {}

  async outbidLots(input: {
    legalEntityId: string;
    bidderId: string | null;
    now: Date;
    limit: number;
  }): Promise<Array<HomeSubject & { endsAt: Date }>> {
    const leading = alias(bid, "leading");
    const placed = and(
      eq(bid.buyerLegalEntityId, input.legalEntityId),
      input.bidderId ? eq(bid.bidderId, input.bidderId) : undefined,
    );
    return this.db
      .select({ id: lot.id, title: lot.title, endsAt: lot.endTime })
      .from(lot)
      .where(
        and(
          inArray(lot.id, this.db.selectDistinct({ id: bid.lotId }).from(bid).where(placed)),
          eq(lot.status, "active"),
          gt(lot.endTime, input.now),
          lotNotDeleted(),
          // The account is not leading: the winning bid, if any, is someone else's.
          notExists(
            this.db
              .select({ one: sql`1` })
              .from(leading)
              .where(
                and(
                  eq(leading.lotId, lot.id),
                  eq(leading.isWinning, true),
                  eq(leading.buyerLegalEntityId, input.legalEntityId),
                ),
              ),
          ),
        ),
      )
      .orderBy(asc(lot.endTime), asc(lot.id))
      .limit(input.limit);
  }

  async openPurchases(input: {
    legalEntityId: string;
    winnerId: string | null;
    limit: number;
  }): Promise<Array<HomeSubject & PurchaseNextStepFacts>> {
    // The lot's latest payment billed to the account.
    const latestStatus = sql<PaymentStatus | null>`(
      select ${payment.status} from ${payment}
      where ${payment.lotId} = ${lot.id} and ${payment.buyerLegalEntityId} = ${input.legalEntityId}
      order by ${payment.createdAt} desc limit 1
    )`;
    const toPay = or(
      sql`${latestStatus} is null`,
      sql`${latestStatus} in (${sql.join(
        TO_PAY.map((status) => sql`${status}`),
        sql`, `,
      )})`,
    );
    const paidNotFinished = and(
      sql`${latestStatus} = 'captured'`,
      isNull(lotFulfilment.collectedAt),
      or(
        isNull(lotFulfilment.status),
        sql`${lotFulfilment.status} not in ('in_transit', 'delivered', 'cancelled')`,
      ),
    );
    // A courier quote the team priced and the account has not answered yet.
    const quoteReady = sql<boolean>`exists (
      select 1 from ${deliveryQuote}
      where ${deliveryQuote.lotId} = ${lot.id}
        and ${deliveryQuote.buyerLegalEntityId} = ${input.legalEntityId}
        and ${deliveryQuote.status} = 'quoted'
    )`;
    const rows = await this.db
      .select({
        id: lot.id,
        title: lot.title,
        paymentStatus: latestStatus,
        quoteReady,
        fulfilmentStatus: lotFulfilment.status,
        method: lotFulfilment.fulfilmentMethod,
        collectedAt: lotFulfilment.collectedAt,
      })
      .from(lot)
      .leftJoin(lotFulfilment, eq(lotFulfilment.lotId, lot.id))
      .where(
        and(
          eq(lot.buyerLegalEntityId, input.legalEntityId),
          eq(lot.status, "ended"),
          input.winnerId ? eq(lot.winnerId, input.winnerId) : isNotNull(lot.winnerId),
          lotNotDeleted(),
          or(toPay, paidNotFinished),
        ),
      )
      .orderBy(desc(lot.endTime), asc(lot.id))
      .limit(input.limit);
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      paymentStatus: row.paymentStatus,
      fulfilment: row.fulfilmentStatus
        ? { status: row.fulfilmentStatus, method: row.method, collectedAt: row.collectedAt }
        : null,
      shippingQuote: row.quoteReady ? ("ready" as const) : null,
    }));
  }

  async agreementsToAccept(input: {
    legalEntityId: string;
    visibleTo: SubmissionSenderFilter | undefined;
    limit: number;
  }): Promise<HomeSubject[]> {
    return this.db
      .select({ id: itemSubmission.id, title: itemSubmission.title })
      .from(itemSubmission)
      .innerJoin(consignmentAgreement, eq(consignmentAgreement.submissionId, itemSubmission.id))
      .where(
        and(
          eq(itemSubmission.legalEntityId, input.legalEntityId),
          submissionSenderSql(input.visibleTo),
          inArray(itemSubmission.status, [...OPEN_CONSIGNMENT]),
          isNull(consignmentAgreement.acceptedAt),
          isNotNull(consignmentAgreement.estimateLow),
          isNotNull(consignmentAgreement.estimateHigh),
          isNotNull(consignmentAgreement.commissionPercent),
        ),
      )
      .orderBy(desc(itemSubmission.updatedAt), asc(itemSubmission.id))
      .limit(input.limit);
  }

  async changesRequested(input: {
    legalEntityId: string;
    visibleTo: SubmissionSenderFilter | undefined;
    limit: number;
  }): Promise<Array<HomeSubject & { note: string | null }>> {
    return this.db
      .select({
        id: itemSubmission.id,
        title: itemSubmission.title,
        note: itemSubmission.changesRequestedNote,
      })
      .from(itemSubmission)
      .where(
        and(
          eq(itemSubmission.legalEntityId, input.legalEntityId),
          submissionSenderSql(input.visibleTo),
          eq(itemSubmission.status, "changes_requested"),
        ),
      )
      .orderBy(desc(itemSubmission.changesRequestedAt), asc(itemSubmission.id))
      .limit(input.limit);
  }

  async expiredInvitations(input: {
    legalEntityId: string;
    since: Date;
    now: Date;
  }): Promise<ExpiredInvitation[]> {
    const later = alias(userInvitation, "later");
    const lapsed = or(
      eq(userInvitation.status, "expired"),
      and(eq(userInvitation.status, "pending"), lte(userInvitation.expiresAt, input.now)),
    );
    // Sent again (and still open) or accepted since: nothing left to do for that address.
    const followedUp = exists(
      this.db
        .select({ one: sql`1` })
        .from(later)
        .where(
          and(
            eq(later.targetLegalEntityId, input.legalEntityId),
            sql`lower(${later.email}) = lower(${userInvitation.email})`,
            gt(later.createdAt, userInvitation.createdAt),
            or(
              eq(later.status, "accepted"),
              and(eq(later.status, "pending"), gt(later.expiresAt, input.now)),
            ),
          ),
        ),
    );
    const rows = await this.db
      .selectDistinctOn([sql`lower(${userInvitation.email})`], {
        id: userInvitation.id,
        email: userInvitation.email,
        expiredAt: userInvitation.expiresAt,
      })
      .from(userInvitation)
      .where(
        and(
          eq(userInvitation.targetLegalEntityId, input.legalEntityId),
          lapsed,
          gte(userInvitation.expiresAt, input.since),
          sql`not ${followedUp}`,
        ),
      )
      .orderBy(sql`lower(${userInvitation.email})`, desc(userInvitation.expiresAt));
    return rows.sort((a, b) => b.expiredAt.getTime() - a.expiredAt.getTime());
  }

  async endingAuthorisations(input: {
    legalEntityId: string;
    userId: string | null;
    now: Date;
    until: Date;
  }): Promise<EndingAuthorisation[]> {
    const rows = await this.db
      .select({
        id: buyerAgentAuthorisation.id,
        memberName: sql<string>`coalesce(${bidIdentityDirectory.name}, 'A buyer agent')`,
        endsAt: buyerAgentAuthorisation.validUntil,
      })
      .from(buyerAgentAuthorisation)
      .leftJoin(
        bidIdentityDirectory,
        eq(bidIdentityDirectory.subjectId, buyerAgentAuthorisation.userId),
      )
      .where(
        and(
          eq(buyerAgentAuthorisation.legalEntityId, input.legalEntityId),
          eq(buyerAgentAuthorisation.status, "active"),
          input.userId ? eq(buyerAgentAuthorisation.userId, input.userId) : undefined,
          gt(buyerAgentAuthorisation.validUntil, input.now),
          lte(buyerAgentAuthorisation.validUntil, input.until),
        ),
      )
      .orderBy(asc(buyerAgentAuthorisation.validUntil), asc(buyerAgentAuthorisation.id));
    return rows.flatMap((row) => (row.endsAt ? [{ ...row, endsAt: row.endsAt }] : []));
  }

  async pendingAccessRequests(input: {
    legalEntityId: string;
    limit: number;
  }): Promise<PendingAccessRequest[]> {
    return this.db
      .select({
        id: accessRequest.id,
        requesterName: sql<string>`coalesce(${bidIdentityDirectory.name}, 'A member')`,
        askedAt: accessRequest.createdAt,
      })
      .from(accessRequest)
      .leftJoin(
        bidIdentityDirectory,
        eq(bidIdentityDirectory.subjectId, accessRequest.requesterUserId),
      )
      .where(
        and(
          eq(accessRequest.legalEntityId, input.legalEntityId),
          eq(accessRequest.status, "pending"),
        ),
      )
      .orderBy(asc(accessRequest.createdAt), asc(accessRequest.id))
      .limit(input.limit);
  }

  async unreadReplies(input: {
    legalEntityId: string;
    visibleTo: SubmissionSenderFilter | undefined;
    limit: number;
  }): Promise<UnreadReply[]> {
    // The newest unread specialist message on each consignment names who wrote.
    const rows = await this.db
      .selectDistinctOn([itemSubmission.id], {
        id: itemSubmission.id,
        title: itemSubmission.title,
        from: sql<string>`coalesce(${bidIdentityDirectory.name}, 'Your specialist')`,
        at: consignmentMessage.createdAt,
      })
      .from(consignmentMessage)
      .innerJoin(consignmentThread, eq(consignmentThread.id, consignmentMessage.threadId))
      .innerJoin(itemSubmission, eq(itemSubmission.id, consignmentThread.submissionId))
      .leftJoin(
        bidIdentityDirectory,
        eq(bidIdentityDirectory.subjectId, consignmentMessage.authorUserId),
      )
      .where(
        and(
          eq(itemSubmission.legalEntityId, input.legalEntityId),
          submissionSenderSql(input.visibleTo),
          eq(consignmentMessage.authorSide, "staff"),
          isNull(consignmentMessage.readAt),
        ),
      )
      .orderBy(asc(itemSubmission.id), desc(consignmentMessage.createdAt));
    return rows
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, input.limit)
      .map(({ id, title, from }) => ({ id, title, from }));
  }

  async viewerChecks(userId: string): Promise<{
    identity: "verified" | "checking" | "required";
    sourceOfFundsRequested: boolean;
  }> {
    const [profile] = await this.db
      .select({ kycStatus: bidUserProfile.kycStatus })
      .from(bidUserProfile)
      .where(eq(bidUserProfile.userId, userId))
      .limit(1);
    const requested: SQL | undefined = and(
      eq(sourceOfFunds.userId, userId),
      eq(sourceOfFunds.status, "pending"),
      isNotNull(sourceOfFunds.documentsRequestedAt),
    );
    const [sof] = await this.db
      .select({ id: sourceOfFunds.id })
      .from(sourceOfFunds)
      .where(requested)
      .limit(1);
    const status = profile?.kycStatus;
    return {
      identity: status === "approved" || status === "pending" ? KYC_IDENTITY[status] : "required",
      sourceOfFundsRequested: sof !== undefined,
    };
  }
}
