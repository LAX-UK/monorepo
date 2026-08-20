import type { Database } from "@auction/db";
import { lotNotDeleted, saleNotDeleted } from "@auction/db";
import {
  adminReviewTask,
  bidIdentityDirectory,
  conditionReportRequest,
  itemSubmission,
  lot,
  lotFulfilment,
  payment,
  sale,
  saleRegistration,
  telephoneBidBooking,
} from "@auction/db/schema";
import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import type {
  AdminAssignableWorkItemsQuery,
  AdminWorkItemSourceRow,
  IAdminWorkItemsReader,
} from "../interfaces/admin-work-items.reader.js";

const REVIEW_TASK_KINDS = [
  "aml_screening_review",
  "source_of_funds_review",
  "legal_entity_kyb_review",
  "lot_withdrawal_request",
  "lot_artist_backfill",
  "artist_merge_review",
  "payout_adjustment_review",
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

function reviewTaskHref(
  kind: (typeof REVIEW_TASK_KINDS)[number],
  payload: Record<string, unknown>,
  taskId: string,
): string {
  switch (kind) {
    case "aml_screening_review":
      return `/admin/compliance/aml/${String(payload.screeningId ?? taskId)}`;
    case "source_of_funds_review":
      return `/admin/compliance/source-of-funds/${String(payload.sourceOfFundsId ?? taskId)}`;
    case "legal_entity_kyb_review":
      return `/admin/legal-entities/${String(payload.legalEntityId ?? taskId)}`;
    case "lot_withdrawal_request":
      return `/admin/lots/${String(payload.lotId ?? taskId)}`;
    default:
      return `/admin/lots/${String(payload.lotId ?? taskId)}`;
  }
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
    case "artist_merge_review":
      return "Artist merge review needed";
    case "payout_adjustment_review":
      return "Payout adjustment review needed";
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
      title: `Payment manual review — Lot ${row.lotNumber ?? "?"}: ${row.lotTitle}`,
      subtitle: `${row.winnerEmail ?? "Buyer"} · ${row.amount}`,
      href: `/admin/payments/${row.paymentId}`,
      saleId: null,
      createdAt: row.createdAt,
      sourceUpdatedAt: row.createdAt,
      assignedToUserId: null,
    }));
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
        href: reviewTaskHref(kind, payload, row.id),
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
      href: `/admin/submissions/${row.id}`,
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
      title: `Condition report — Lot ${row.lotNumber ?? "?"}: ${row.lotTitle}`,
      subtitle: row.status === "in_progress" ? "In progress" : "Pending",
      href: `/admin/condition-reports?preview=${row.id}`,
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
      title: `Fulfilment — Lot ${row.lotNumber ?? "?"}: ${row.lotTitle}`,
      subtitle: row.status.replaceAll("_", " "),
      href: `/admin/lot-fulfilment?preview=${row.lotId}`,
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
      href: `/admin/sales/${row.saleId}/registrations?status=pending`,
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
      href: `/admin/sales/${row.saleId}/telephone-bookings?status=${row.status}`,
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
      href: `/admin/lots/${row.id}`,
      saleId: null,
      createdAt: row.createdAt,
      sourceUpdatedAt: row.updatedAt,
      assignedToUserId: null,
    }));
  }
}
