import type { Database } from "@auction/db";
import { lotNotDeleted, saleNotDeleted } from "@auction/db";
import {
  adminReviewTask,
  bidIdentityDirectory,
  bidInvoice,
  conditionReportRequest,
  domainEvent,
  itemSubmission,
  lot,
  lotFulfilment,
  marketingEnquiry,
  payment,
  purchaseProblem,
  sale,
  saleRegistration,
  telephoneBidBooking,
  unsoldChoiceDeadline,
  unsoldLotChoice,
  unsoldLotFollowUp,
} from "@auction/db/schema";
import {
  UNAPPLIED_MONEY_HANDLED_ELSEWHERE,
  UNSOLD_LOT_END_STATUSES,
  possibleSourceText,
  storedDueAt,
} from "@auction/domain";
import { INVOICE_PAYMENT_DUE_DAYS, type UnsoldLotChoiceKind } from "@auction/types";
import { and, desc, eq, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";
import type {
  AdminAssignableWorkItemsQuery,
  AdminWorkItemSourceRow,
  IAdminWorkItemsReader,
} from "../interfaces/admin-work-items.reader.js";
import { adminWorkItemHref } from "../lib/admin-work-item-href.js";
import { findRegisterLotMismatches } from "./artwork-register/register-lot-mismatch.query.js";
import { BLOCKED_CAPTURE_EVENT, toBlockedCapture } from "./blocked-capture.query.js";
import { DrizzleUnappliedMoneyReader } from "./drizzle-unapplied-money.reader.js";
import { lotWorkItemTitle, sentenceCase } from "./work-item-labels.js";

const DUE_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/London",
});
const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

/** A payment amount stored as a decimal string, shown as pounds ("83750.00" -> "£83,750.00"). */
export function formatWorkItemAmount(amount: string | number): string {
  const n = typeof amount === "number" ? amount : Number.parseFloat(amount);
  return Number.isFinite(n) ? GBP.format(n) : String(amount);
}

const REVIEW_TASK_KINDS = [
  "aml_screening_review",
  "source_of_funds_review",
  "legal_entity_kyb_review",
  "lot_withdrawal_request",
  "lot_artist_backfill",
] as const;

function reviewTaskKindToWorkKind(
  kind: (typeof REVIEW_TASK_KINDS)[number],
): AdminWorkItemSourceRow["kind"] {
  switch (kind) {
    case "aml_screening_review":
      return "aml_screening";
    case "source_of_funds_review":
      return "sof_case";
    case "legal_entity_kyb_review":
      return "legal_entity_kyb";
    case "lot_withdrawal_request":
      return "lot_withdrawal";
    default:
      return "lot_withdrawal";
  }
}

function reviewTaskDomain(
  kind: (typeof REVIEW_TASK_KINDS)[number],
): AdminWorkItemSourceRow["domain"] {
  switch (kind) {
    case "aml_screening_review":
    case "source_of_funds_review":
      return "compliance";
    case "legal_entity_kyb_review":
      return "clients";
    default:
      return "catalogue";
  }
}

/** The record a review task is about, from the id its projector stored in the payload. */
function reviewTaskSubjectId(
  kind: (typeof REVIEW_TASK_KINDS)[number],
  payload: Record<string, unknown>,
): string | null {
  const key = {
    aml_screening_review: "screeningId",
    source_of_funds_review: "sourceOfFundsId",
    legal_entity_kyb_review: "legalEntityId",
    lot_withdrawal_request: "lotId",
    lot_artist_backfill: "lotId",
  }[kind];
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function reviewTaskTitle(kind: (typeof REVIEW_TASK_KINDS)[number]): string {
  switch (kind) {
    case "aml_screening_review":
      return "AML screening needs review";
    case "source_of_funds_review":
      return "Source of funds case needs review";
    case "legal_entity_kyb_review":
      return "Legal entity KYB needs review";
    case "lot_withdrawal_request":
      return "Lot withdrawal request pending";
    case "lot_artist_backfill":
      return "Artist backfill review needed";
    default:
      return "Review task pending";
  }
}

export class DrizzleAdminWorkItemsReader implements IAdminWorkItemsReader {
  constructor(private readonly db: Database) {}

  async listManualReviewPayments(limit: number): Promise<AdminWorkItemSourceRow[]> {
    const rows = await this.db
      .select({
        paymentId: payment.id,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        winnerEmail: bidIdentityDirectory.email,
        amount: payment.amount,
        createdAt: payment.createdAt,
      })
      .from(payment)
      .innerJoin(lot, eq(payment.lotId, lot.id))
      .leftJoin(bidIdentityDirectory, eq(payment.buyerId, bidIdentityDirectory.subjectId))
      .where(eq(payment.status, "requires_manual_review"))
      .orderBy(desc(payment.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      sourceId: row.paymentId,
      kind: "payment_manual_review" as const,
      domain: "finance" as const,
      title: lotWorkItemTitle("Payment manual review", row.lotNumber, row.lotTitle),
      subtitle: `${row.winnerEmail ?? "Buyer"} · ${formatWorkItemAmount(row.amount)}`,
      href: adminWorkItemHref("payment_manual_review", { subjectId: row.paymentId }),
      saleId: null,
      createdAt: row.createdAt,
      sourceUpdatedAt: row.createdAt,
      assignedToUserId: null,
    }));
  }

  async listBlockedCaptures(limit: number): Promise<AdminWorkItemSourceRow[]> {
    // One row per payment (its latest event), kept only while the payment is still closed:
    // reinstating it or refunding the buyer moves it on and the item leaves the inbox.
    const rows = await this.db
      .selectDistinctOn([domainEvent.aggregateId], {
        aggregateId: domainEvent.aggregateId,
        payload: domainEvent.payload,
        occurredAt: domainEvent.occurredAt,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        winnerEmail: bidIdentityDirectory.email,
        amount: payment.amount,
      })
      .from(domainEvent)
      .innerJoin(payment, eq(sql`${payment.id}::text`, domainEvent.aggregateId))
      .innerJoin(lot, eq(payment.lotId, lot.id))
      .leftJoin(bidIdentityDirectory, eq(payment.buyerId, bidIdentityDirectory.subjectId))
      .where(
        and(
          eq(domainEvent.aggregateType, "payment"),
          eq(domainEvent.eventType, BLOCKED_CAPTURE_EVENT),
          eq(payment.status, "cancelled"),
        ),
      )
      .orderBy(domainEvent.aggregateId, desc(domainEvent.occurredAt))
      .limit(limit);

    return rows.map((row) => {
      const blocked = toBlockedCapture(row);
      return {
        sourceId: row.aggregateId,
        kind: "payment_capture_blocked" as const,
        domain: "finance" as const,
        title: lotWorkItemTitle("Payment taken on a closed payment", row.lotNumber, row.lotTitle),
        subtitle: `${row.winnerEmail ?? "Buyer"} · ${formatWorkItemAmount(row.amount)}`,
        href: adminWorkItemHref("payment_capture_blocked", { paymentId: row.aggregateId }),
        saleId: null,
        createdAt: blocked.blockedAt,
        sourceUpdatedAt: blocked.blockedAt,
        assignedToUserId: null,
      };
    });
  }

  async listUnappliedMoney(limit: number): Promise<AdminWorkItemSourceRow[]> {
    const open = await new DrizzleUnappliedMoneyReader(this.db).listOpen({
      limit,
      excludeReasons: UNAPPLIED_MONEY_HANDLED_ELSEWHERE,
    });
    return open.map((money) => ({
      sourceId: money.dedupeKey,
      kind: "payment_money_unapplied" as const,
      domain: "finance" as const,
      title: "Money received that could not be applied",
      subtitle: `${sentenceCase(money.reason)} · ${formatWorkItemAmount(money.amountCents / 100)}`,
      hint: possibleSourceText(money.possibleGroup ?? null),
      href: adminWorkItemHref("payment_money_unapplied", { paymentId: money.paymentId }),
      saleId: null,
      createdAt: money.receivedAt,
      sourceUpdatedAt: money.receivedAt,
      assignedToUserId: null,
    }));
  }

  async listOverduePayments(limit: number, now: Date): Promise<AdminWorkItemSourceRow[]> {
    // Unpaid won lots from the day after their due date (London calendar days). A payment held
    // for our own checks is already in finance's manual-review list and is not the buyer's
    // fault, so it is left out; so is a sale that has been cancelled.
    const rows = await this.db
      .select({
        lotId: lot.id,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        saleId: lot.saleId,
        amount: payment.amount,
        raisedAt: payment.createdAt,
        dueAt: bidInvoice.dueAt,
        winnerEmail: bidIdentityDirectory.email,
      })
      .from(payment)
      .leftJoin(bidInvoice, eq(bidInvoice.id, payment.invoiceId))
      .innerJoin(lot, eq(payment.lotId, lot.id))
      .leftJoin(lotFulfilment, eq(lotFulfilment.lotId, lot.id))
      .leftJoin(bidIdentityDirectory, eq(payment.buyerId, bidIdentityDirectory.subjectId))
      .where(
        and(
          isNull(bidInvoice.voidedAt),
          inArray(payment.status, ["pending", "cancelled"]),
          eq(lot.status, "ended"),
          eq(lot.winnerId, payment.buyerId),
          isNull(lot.deletedAt),
          or(isNull(lotFulfilment.status), ne(lotFulfilment.status, "cancelled")),
          // An invoice is overdue by its stored due date. A payment with no stored invoice is
          // never dropped: it is a candidate once it is old enough that its term could have
          // ended, and the domain rule below decides.
          or(
            lt(bidInvoice.dueAt, now),
            and(
              isNull(bidInvoice.id),
              lt(
                payment.createdAt,
                new Date(now.getTime() - INVOICE_PAYMENT_DUE_DAYS * 86_400_000),
              ),
            ),
          ),
        ),
      )
      // Longest overdue first: by the stored due date, which a released hold may have moved;
      // a payment with no stored invoice by the due date its age gives (the same term as above).
      .orderBy(
        sql`coalesce(${bidInvoice.dueAt}, ${payment.createdAt} + (${INVOICE_PAYMENT_DUE_DAYS}::int * interval '1 day'))`,
      )
      .limit(limit);

    const overdue = rows.flatMap((row) => {
      const dueAt = storedDueAt({ raisedAt: row.raisedAt, dueAt: row.dueAt });
      return dueAt.getTime() < now.getTime() ? [{ ...row, dueAt }] : [];
    });
    return overdue.map((row) => {
      const dueAt = row.dueAt;
      return {
        sourceId: row.lotId,
        kind: "payment_overdue" as const,
        domain: "finance" as const,
        title: lotWorkItemTitle("Payment overdue", row.lotNumber, row.lotTitle),
        subtitle: `${row.winnerEmail ?? "Buyer"} · ${formatWorkItemAmount(row.amount)} · due ${DUE_DATE.format(dueAt)}`,
        href: adminWorkItemHref("payment_overdue", { subjectId: row.lotId }),
        saleId: row.saleId,
        createdAt: dueAt,
        sourceUpdatedAt: new Date(dueAt.getTime() + 86_400_000),
        assignedToUserId: null,
      };
    });
  }

  async listPendingReviewTasks(
    query: AdminAssignableWorkItemsQuery,
  ): Promise<AdminWorkItemSourceRow[]> {
    const assignmentPredicate =
      query.assignment === "mine"
        ? eq(adminReviewTask.assignedToUserId, query.actorUserId)
        : query.assignment === "unassigned"
          ? isNull(adminReviewTask.assignedToUserId)
          : undefined;
    const rows = await this.db
      .select()
      .from(adminReviewTask)
      .where(
        and(
          inArray(adminReviewTask.kind, [...REVIEW_TASK_KINDS]),
          eq(adminReviewTask.status, "pending"),
          assignmentPredicate,
        ),
      )
      .orderBy(desc(adminReviewTask.createdAt))
      .limit(query.limit);

    return rows.map((row) => {
      const kind = row.kind as (typeof REVIEW_TASK_KINDS)[number];
      const payload = (row.payload ?? {}) as Record<string, unknown>;
      return {
        sourceId: row.id,
        kind: reviewTaskKindToWorkKind(kind),
        domain: reviewTaskDomain(kind),
        title: reviewTaskTitle(kind),
        subtitle: kind === "lot_withdrawal_request" ? "Seller withdrawal" : null,
        href: adminWorkItemHref(reviewTaskKindToWorkKind(kind), {
          subjectId: reviewTaskSubjectId(kind, payload),
        }),
        saleId: null,
        createdAt: row.createdAt,
        sourceUpdatedAt: row.createdAt,
        assignedToUserId: row.assignedToUserId,
        meta: { reviewTaskKind: kind },
      };
    });
  }

  async listSubmissionReviews(
    query: AdminAssignableWorkItemsQuery,
  ): Promise<AdminWorkItemSourceRow[]> {
    const assignmentPredicate =
      query.assignment === "mine"
        ? eq(itemSubmission.assignedToUserId, query.actorUserId)
        : query.assignment === "unassigned"
          ? isNull(itemSubmission.assignedToUserId)
          : undefined;
    const rows = await this.db
      .select({
        id: itemSubmission.id,
        title: itemSubmission.title,
        status: itemSubmission.status,
        assignedToUserId: itemSubmission.assignedToUserId,
        createdAt: itemSubmission.createdAt,
        updatedAt: itemSubmission.updatedAt,
      })
      .from(itemSubmission)
      .where(
        and(inArray(itemSubmission.status, ["submitted", "under_review"]), assignmentPredicate),
      )
      .orderBy(desc(itemSubmission.updatedAt))
      .limit(query.limit);

    return rows.map((row) => ({
      sourceId: row.id,
      kind: "submission_review" as const,
      domain: "catalogue" as const,
      title: row.title,
      subtitle: row.status === "under_review" ? "Under review" : "Awaiting review",
      href: adminWorkItemHref("submission_review", { subjectId: row.id }),
      saleId: null,
      createdAt: row.createdAt,
      sourceUpdatedAt: row.updatedAt,
      assignedToUserId: row.assignedToUserId,
      meta: { submissionStatus: row.status },
    }));
  }

  async listConditionReports(limit: number): Promise<AdminWorkItemSourceRow[]> {
    const rows = await this.db
      .select({
        id: conditionReportRequest.id,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        status: conditionReportRequest.status,
        createdAt: conditionReportRequest.createdAt,
      })
      .from(conditionReportRequest)
      .innerJoin(lot, eq(conditionReportRequest.lotId, lot.id))
      .where(inArray(conditionReportRequest.status, ["pending", "in_progress"]))
      .orderBy(desc(conditionReportRequest.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      sourceId: row.id,
      kind: "condition_report" as const,
      domain: "catalogue" as const,
      title: lotWorkItemTitle("Condition report", row.lotNumber, row.lotTitle),
      subtitle: row.status === "in_progress" ? "In progress" : "Pending",
      href: adminWorkItemHref("condition_report", { subjectId: row.id }),
      saleId: null,
      createdAt: row.createdAt,
      sourceUpdatedAt: row.createdAt,
      assignedToUserId: null,
      meta: { conditionReportStatus: row.status },
    }));
  }

  async listLotFulfilment(limit: number): Promise<AdminWorkItemSourceRow[]> {
    const rows = await this.db
      .select({
        lotId: lotFulfilment.lotId,
        status: lotFulfilment.status,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        updatedAt: lotFulfilment.updatedAt,
        createdAt: lotFulfilment.createdAt,
      })
      .from(lotFulfilment)
      .innerJoin(lot, eq(lotFulfilment.lotId, lot.id))
      .where(
        inArray(lotFulfilment.status, [
          "awaiting_release",
          "released",
          "ready_for_collection",
          "in_transit",
        ]),
      )
      .orderBy(desc(lotFulfilment.updatedAt))
      .limit(limit);

    return rows.map((row) => ({
      sourceId: row.lotId,
      kind: "lot_fulfilment" as const,
      domain: "fulfilment" as const,
      title: lotWorkItemTitle("Fulfilment", row.lotNumber, row.lotTitle),
      subtitle: sentenceCase(row.status),
      href: adminWorkItemHref("lot_fulfilment", { subjectId: row.lotId }),
      saleId: null,
      createdAt: row.createdAt,
      sourceUpdatedAt: row.updatedAt,
      assignedToUserId: null,
      meta: { fulfilmentStatus: row.status },
    }));
  }

  async listPendingRegistrations(limit: number): Promise<AdminWorkItemSourceRow[]> {
    const rows = await this.db
      .select({
        id: saleRegistration.id,
        saleId: saleRegistration.saleId,
        saleTitle: sale.title,
        userEmail: bidIdentityDirectory.email,
        userName: bidIdentityDirectory.name,
        requestedAt: saleRegistration.requestedAt,
      })
      .from(saleRegistration)
      .innerJoin(sale, eq(saleRegistration.saleId, sale.id))
      .leftJoin(bidIdentityDirectory, eq(saleRegistration.userId, bidIdentityDirectory.subjectId))
      .where(and(eq(saleRegistration.status, "pending"), saleNotDeleted()))
      .orderBy(desc(saleRegistration.requestedAt))
      .limit(limit);

    return rows.map((row) => ({
      sourceId: row.id,
      kind: "sale_registration" as const,
      domain: "saleroom" as const,
      title: `Registration pending — ${row.saleTitle}`,
      subtitle: row.userName ?? row.userEmail ?? "Bidder",
      href: adminWorkItemHref("sale_registration", { saleId: row.saleId }),
      saleId: row.saleId,
      createdAt: row.requestedAt,
      sourceUpdatedAt: row.requestedAt,
      assignedToUserId: null,
      meta: { registrationId: row.id, saleId: row.saleId },
    }));
  }

  async listPendingTelephoneBookings(limit: number): Promise<AdminWorkItemSourceRow[]> {
    const rows = await this.db
      .select({
        id: telephoneBidBooking.id,
        saleId: telephoneBidBooking.saleId,
        saleTitle: sale.title,
        userEmail: bidIdentityDirectory.email,
        userName: bidIdentityDirectory.name,
        status: telephoneBidBooking.status,
        createdAt: telephoneBidBooking.createdAt,
        updatedAt: telephoneBidBooking.updatedAt,
      })
      .from(telephoneBidBooking)
      .innerJoin(sale, eq(telephoneBidBooking.saleId, sale.id))
      .leftJoin(
        bidIdentityDirectory,
        eq(telephoneBidBooking.userId, bidIdentityDirectory.subjectId),
      )
      .where(
        and(
          inArray(telephoneBidBooking.status, ["requested", "confirmed"]),
          or(isNull(telephoneBidBooking.clerkUserId), eq(telephoneBidBooking.status, "requested")),
          saleNotDeleted(),
        ),
      )
      .orderBy(desc(telephoneBidBooking.updatedAt))
      .limit(limit);

    return rows.map((row) => ({
      sourceId: row.id,
      kind: "telephone_booking" as const,
      domain: "saleroom" as const,
      title: `Telephone booking — ${row.saleTitle}`,
      subtitle: row.userName ?? row.userEmail ?? "Bidder",
      href: adminWorkItemHref("telephone_booking", { saleId: row.saleId, status: row.status }),
      saleId: row.saleId,
      createdAt: row.createdAt,
      sourceUpdatedAt: row.updatedAt,
      assignedToUserId: null,
      meta: { bookingId: row.id, bookingStatus: row.status },
    }));
  }

  async listDraftLotsPastStart(limit: number): Promise<AdminWorkItemSourceRow[]> {
    const now = new Date();
    const rows = await this.db
      .select({
        id: lot.id,
        title: lot.title,
        lotNumber: lot.lotNumber,
        startTime: lot.startTime,
        updatedAt: lot.updatedAt,
        createdAt: lot.createdAt,
      })
      .from(lot)
      .where(and(eq(lot.status, "draft"), lt(lot.startTime, now), lotNotDeleted()))
      .orderBy(desc(lot.updatedAt))
      .limit(limit);

    return rows.map((row) => ({
      sourceId: row.id,
      kind: "lot_draft_past_start" as const,
      domain: "catalogue" as const,
      title: `Draft lot past start — ${row.title}`,
      subtitle: row.lotNumber != null ? `Lot ${row.lotNumber}` : "Unnumbered",
      href: adminWorkItemHref("lot_draft_past_start", { subjectId: row.id }),
      saleId: null,
      createdAt: row.createdAt,
      sourceUpdatedAt: row.updatedAt,
      assignedToUserId: null,
    }));
  }

  async listUnsoldLotChoices(limit: number): Promise<AdminWorkItemSourceRow[]> {
    const rows = await this.db
      .select({
        id: unsoldLotChoice.id,
        submissionId: unsoldLotChoice.submissionId,
        requestedChoice: unsoldLotChoice.requestedChoice,
        requestedAt: unsoldLotChoice.requestedAt,
        createdAt: unsoldLotChoice.createdAt,
        updatedAt: unsoldLotChoice.updatedAt,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
      })
      .from(unsoldLotChoice)
      .innerJoin(lot, eq(unsoldLotChoice.lotId, lot.id))
      .where(eq(unsoldLotChoice.status, "requested"))
      .orderBy(desc(unsoldLotChoice.updatedAt))
      .limit(limit);

    return rows.map((row) => ({
      sourceId: row.id,
      kind: "unsold_lot_choice" as const,
      domain: "catalogue" as const,
      title: lotWorkItemTitle("Unsold lot choice", row.lotNumber, row.lotTitle),
      subtitle: UNSOLD_CHOICE_SUBTITLES[row.requestedChoice ?? ""] ?? null,
      href: adminWorkItemHref("unsold_lot_choice", { subjectId: row.submissionId }),
      saleId: null,
      createdAt: row.requestedAt ?? row.createdAt,
      sourceUpdatedAt: row.updatedAt,
      assignedToUserId: null,
    }));
  }

  async listOpenUnsoldFollowUps(limit: number): Promise<AdminWorkItemSourceRow[]> {
    const rows = await this.db
      .select({
        id: unsoldLotFollowUp.id,
        submissionId: unsoldLotFollowUp.submissionId,
        kind: unsoldLotFollowUp.kind,
        reserve: unsoldLotFollowUp.reserve,
        createdAt: unsoldLotFollowUp.createdAt,
        updatedAt: unsoldLotFollowUp.updatedAt,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
      })
      .from(unsoldLotFollowUp)
      .innerJoin(lot, eq(unsoldLotFollowUp.lotId, lot.id))
      .where(and(eq(unsoldLotFollowUp.status, "open"), lotNotDeleted()))
      .orderBy(desc(unsoldLotFollowUp.createdAt))
      .limit(limit);

    return rows.map((row) => {
      const work = UNSOLD_FOLLOW_UP_WORK[row.kind as UnsoldLotChoiceKind];
      return {
        sourceId: row.id,
        kind: "unsold_choice_follow_up" as const,
        domain: "catalogue" as const,
        title: lotWorkItemTitle(work.title, row.lotNumber, row.lotTitle),
        subtitle: work.subtitle(row.reserve),
        href: adminWorkItemHref("unsold_choice_follow_up", { subjectId: row.submissionId }),
        saleId: null,
        createdAt: row.createdAt,
        sourceUpdatedAt: row.createdAt,
        assignedToUserId: null,
      };
    });
  }

  async listLapsedUnsoldChoices(limit: number, now: Date): Promise<AdminWorkItemSourceRow[]> {
    const rows = await this.db
      .select({
        lotId: lot.id,
        submissionId: itemSubmission.id,
        chooseBy: unsoldChoiceDeadline.chooseBy,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
      })
      .from(unsoldChoiceDeadline)
      .innerJoin(
        lot,
        and(
          eq(lot.id, unsoldChoiceDeadline.lotId),
          eq(lot.endTime, unsoldChoiceDeadline.lotEndTime),
        ),
      )
      .innerJoin(itemSubmission, eq(itemSubmission.convertedLotId, lot.id))
      .leftJoin(
        unsoldLotChoice,
        and(eq(unsoldLotChoice.lotId, lot.id), eq(unsoldLotChoice.lotEndTime, lot.endTime)),
      )
      .where(
        and(
          lt(unsoldChoiceDeadline.chooseBy, now),
          isNull(lot.winnerId),
          inArray(lot.status, [...UNSOLD_LOT_END_STATUSES]),
          // A request waiting for a specialist has its own item, and a confirmed choice its work.
          isNull(unsoldLotChoice.id),
          lotNotDeleted(),
        ),
      )
      .orderBy(desc(unsoldChoiceDeadline.chooseBy))
      .limit(limit);

    return rows.map((row) => ({
      sourceId: row.lotId,
      kind: "unsold_choice_lapsed" as const,
      domain: "catalogue" as const,
      title: lotWorkItemTitle("No choice made", row.lotNumber, row.lotTitle),
      subtitle: `Choose-by date was ${LAPSED_DATE.format(row.chooseBy)}. Contact the seller`,
      href: adminWorkItemHref("unsold_choice_lapsed", { subjectId: row.submissionId }),
      saleId: null,
      createdAt: row.chooseBy,
      sourceUpdatedAt: row.chooseBy,
      assignedToUserId: null,
    }));
  }

  async listMarketingEnquiries(limit: number): Promise<AdminWorkItemSourceRow[]> {
    const rows = await this.db
      .select({
        id: marketingEnquiry.id,
        topic: marketingEnquiry.topic,
        name: marketingEnquiry.name,
        createdAt: marketingEnquiry.createdAt,
      })
      .from(marketingEnquiry)
      .where(eq(marketingEnquiry.status, "new"))
      .orderBy(desc(marketingEnquiry.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      sourceId: row.id,
      kind: "marketing_enquiry" as const,
      domain: "clients" as const,
      title: `Contact enquiry — ${sentenceCase(row.topic)}`,
      subtitle: row.name,
      href: adminWorkItemHref("marketing_enquiry", { subjectId: row.id }),
      saleId: null,
      createdAt: row.createdAt,
      sourceUpdatedAt: row.createdAt,
      assignedToUserId: null,
    }));
  }

  async listPurchaseProblems(limit: number): Promise<AdminWorkItemSourceRow[]> {
    const rows = await this.db
      .select({
        id: purchaseProblem.id,
        assignedToUserId: purchaseProblem.assignedToUserId,
        category: purchaseProblem.category,
        createdAt: purchaseProblem.createdAt,
        updatedAt: purchaseProblem.updatedAt,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
      })
      .from(purchaseProblem)
      .innerJoin(lot, eq(purchaseProblem.lotId, lot.id))
      .where(ne(purchaseProblem.status, "resolved"))
      .orderBy(desc(purchaseProblem.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      sourceId: row.id,
      kind: "purchase_problem" as const,
      domain: "clients" as const,
      title: lotWorkItemTitle("Purchase problem", row.lotNumber, row.lotTitle),
      subtitle: PURCHASE_PROBLEM_SUBTITLES[row.category] ?? null,
      href: adminWorkItemHref("purchase_problem", { subjectId: row.id }),
      saleId: null,
      createdAt: row.createdAt,
      sourceUpdatedAt: row.updatedAt,
      assignedToUserId: row.assignedToUserId,
    }));
  }

  async listDeletionHolds(limit: number): Promise<AdminWorkItemSourceRow[]> {
    const rows = await this.db
      .select({
        subjectId: bidIdentityDirectory.subjectId,
        heldAt: bidIdentityDirectory.deletionHeldAt,
        requestedAt: bidIdentityDirectory.deletionRequestedAt,
        reasons: bidIdentityDirectory.deletionHoldReasons,
      })
      .from(bidIdentityDirectory)
      .where(isNotNull(bidIdentityDirectory.deletionHeldAt))
      .orderBy(desc(bidIdentityDirectory.deletionHeldAt))
      .limit(limit);

    return rows.map((row) => {
      const reasons = Array.isArray(row.reasons) ? (row.reasons as { message?: unknown }[]) : [];
      const first = typeof reasons[0]?.message === "string" ? reasons[0].message : null;
      const heldAt = row.heldAt as Date;
      return {
        sourceId: row.subjectId,
        kind: "deletion_hold" as const,
        domain: "clients" as const,
        title: "Account deletion on hold",
        subtitle: first
          ? `${first}${reasons.length > 1 ? ` (+${reasons.length - 1} more)` : ""}`
          : null,
        href: adminWorkItemHref("deletion_hold", { subjectId: row.subjectId }),
        saleId: null,
        createdAt: heldAt,
        sourceUpdatedAt: heldAt,
        assignedToUserId: null,
      };
    });
  }

  async listRegisterLotMismatches(limit: number): Promise<AdminWorkItemSourceRow[]> {
    const mismatches = await findRegisterLotMismatches(this.db, limit);
    return mismatches.map((row) => ({
      sourceId: row.registerId,
      kind: "register_lot_mismatch" as const,
      domain: "catalogue" as const,
      title: "Register says this artwork is in a LAX Bid sale, but the lot isn't live",
      subtitle: `${row.stockCode} · ${row.title} · ${registerLotMismatchState(row.lotStatus)}`,
      href: adminWorkItemHref("register_lot_mismatch", {
        subjectId: row.lotStatus === null ? null : row.lotId,
      }),
      saleId: null,
      createdAt: row.changedAt,
      sourceUpdatedAt: row.changedAt,
      assignedToUserId: null,
    }));
  }
}

/** What the lot is, in words, when the register still places the artwork in a sale. */
const REGISTER_LOT_MISMATCH_STATE: Record<string, string> = {
  draft: "the lot is a draft",
  cancelled: "the lot was cancelled",
  voided: "the lot was voided",
  ended: "the lot ended with no winner",
};

function registerLotMismatchState(status: string | null): string {
  if (status === null) return "no lot found";
  return REGISTER_LOT_MISMATCH_STATE[status] ?? `the lot is ${status}`;
}

const PURCHASE_PROBLEM_SUBTITLES: Record<string, string> = {
  not_as_described: "Not as described",
  damaged: "Damaged",
  not_received: "Not received",
  invoice_or_payment: "Invoice or payment",
  other: "Other",
};

const LAPSED_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/London",
});

/** The work a confirmed choice leaves, as the inbox words it. One entry per kind of choice. */
const UNSOLD_FOLLOW_UP_WORK: Record<
  UnsoldLotChoiceKind,
  { title: string; subtitle: (reserve: string | null) => string }
> = {
  relist: {
    title: "Relist",
    subtitle: (reserve) =>
      reserve
        ? `Return to inventory at a reserve of ${formatWorkItemAmount(reserve)}`
        : "Return to inventory with its current reserve",
  },
  collect: { title: "Arrange return", subtitle: () => "Seller asked for the lot back" },
  private_sale: { title: "Private sale", subtitle: () => "For the private sales team" },
};

const UNSOLD_CHOICE_SUBTITLES: Record<string, string> = {
  relist: "Seller asks to relist",
  private_sale: "Seller asks for a private sale",
  collect: "Seller asks to collect",
};
