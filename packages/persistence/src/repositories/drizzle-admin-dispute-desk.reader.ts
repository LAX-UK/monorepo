import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  disputeAllocation,
  disputeCase,
  disputeCaseCandidate,
  legalEntity,
  lot,
  payment,
} from "@auction/db/schema";
import {
  DISPUTE_CLOSED_STATUSES,
  DISPUTE_STATUSES_WITHOUT_LOSS,
  DISPUTE_UNDER_REVIEW_STATUSES,
} from "@auction/domain";
import type {
  DisputeDeskAllocationLine,
  DisputeDeskCaseSummary,
  DisputeDeskClawback,
  DisputeDeskCounts,
  DisputeDeskInvoice,
  DisputeDeskView,
} from "@auction/types";
import {
  type SQL,
  and,
  asc,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import type {
  DisputeDeskCaseRecord,
  DisputeDeskListInput,
  IAdminDisputeDeskReader,
} from "../interfaces/admin-dispute-desk.reader.js";

type CaseRow = typeof disputeCase.$inferSelect;

const NOT_OPEN_STATUSES = [...DISPUTE_CLOSED_STATUSES, ...DISPUTE_UNDER_REVIEW_STATUSES];

/** The cases a view holds. `all` holds every case. */
function viewCondition(view: DisputeDeskView): SQL | undefined {
  switch (view) {
    case "needs_allocation":
      return and(
        eq(disputeCase.allocationState, "needs_allocation"),
        notInArray(disputeCase.status, [...DISPUTE_STATUSES_WITHOUT_LOSS]),
      );
    case "open":
      return notInArray(disputeCase.status, NOT_OPEN_STATUSES);
    case "under_review":
      return inArray(disputeCase.status, [...DISPUTE_UNDER_REVIEW_STATUSES]);
    case "closed":
      return inArray(disputeCase.status, [...DISPUTE_CLOSED_STATUSES]);
    default:
      return undefined;
  }
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, "\\$&");

const INVOICE_COLUMNS = {
  paymentId: payment.id,
  lotId: payment.lotId,
  lotTitle: lot.title,
  buyerId: payment.buyerId,
  buyerName: bidIdentityDirectory.name,
  buyerEmail: bidIdentityDirectory.email,
  sellerId: payment.sellerLegalEntityId,
  sellerName: legalEntity.displayName,
  invoicePence: sql<number>`round(${payment.amount} * 100)::int`,
  platformFeePence: sql<number>`round(${payment.platformFee} * 100)::int`,
  paymentStatus: payment.status,
};

type InvoiceRow = {
  paymentId: string;
  lotId: string;
  lotTitle: string;
  buyerId: string;
  buyerName: string | null;
  buyerEmail: string | null;
  sellerId: string;
  sellerName: string;
  invoicePence: number;
  platformFeePence: number;
  paymentStatus: string;
};

const toInvoice = (row: InvoiceRow): DisputeDeskInvoice => ({
  paymentId: row.paymentId,
  reference: row.paymentId.slice(0, 8).toUpperCase(),
  lotId: row.lotId,
  lotTitle: row.lotTitle,
  sellerId: row.sellerId,
  sellerName: row.sellerName,
  invoicePence: row.invoicePence,
  platformFeePence: row.platformFeePence,
  paymentStatus: row.paymentStatus,
});

const buyerLabel = (row: InvoiceRow): string | null =>
  row.buyerName?.trim() || row.buyerEmail || null;

export class DrizzleAdminDisputeDeskReader implements IAdminDisputeDeskReader {
  constructor(private readonly db: Database) {}

  async listPage(input: DisputeDeskListInput) {
    const where = and(
      viewCondition(input.view),
      input.reason ? eq(disputeCase.reason, input.reason) : undefined,
      input.q ? this.searchCondition(input.q) : undefined,
    );
    const closedFirstLast = sql`case when ${inArray(disputeCase.status, [...DISPUTE_CLOSED_STATUSES])} then 1 else 0 end`;
    const [cases, counts] = await Promise.all([
      this.db
        .select()
        .from(disputeCase)
        .where(where)
        .orderBy(
          asc(closedFirstLast),
          sql`${disputeCase.dueBy} asc nulls last`,
          desc(disputeCase.stripeCreatedAt),
          asc(disputeCase.id),
        )
        .limit(input.limit + 1)
        .offset(input.offset),
      this.countViews(),
    ]);
    const hasNextPage = cases.length > input.limit;
    const page = hasNextPage ? cases.slice(0, input.limit) : cases;
    const invoicesByCase = await this.invoicesByCase(page.map((c) => c.id));
    return {
      rows: page.map((row) => this.toSummary(row, invoicesByCase.get(row.id) ?? [])),
      hasNextPage,
      counts,
    };
  }

  async findCase(caseId: string): Promise<DisputeDeskCaseRecord | null> {
    const [row] = await this.db.select().from(disputeCase).where(eq(disputeCase.id, caseId));
    if (!row) return null;
    const [invoiceRows, allocationRows] = await Promise.all([
      this.invoicesByCase([row.id]).then((byCase) => byCase.get(row.id) ?? []),
      this.db
        .select({
          paymentId: disputeAllocation.paymentId,
          amountPence: disputeAllocation.amountPence,
          sellerSharePence: disputeAllocation.sellerSharePence,
          clawback: disputeAllocation.clawback,
          source: disputeAllocation.source,
          allocatedAt: disputeAllocation.createdAt,
          allocatedByName: bidIdentityDirectory.name,
        })
        .from(disputeAllocation)
        .leftJoin(
          bidIdentityDirectory,
          eq(bidIdentityDirectory.subjectId, disputeAllocation.allocatedByUserId),
        )
        .where(eq(disputeAllocation.caseId, row.id))
        .orderBy(asc(disputeAllocation.createdAt), asc(disputeAllocation.id)),
    ]);
    const allocations: DisputeDeskAllocationLine[] = allocationRows.map((a) => ({
      paymentId: a.paymentId,
      amountPence: a.amountPence,
      sellerSharePence: a.sellerSharePence,
      clawback: a.clawback as DisputeDeskClawback,
      source: a.source as DisputeDeskAllocationLine["source"],
      allocatedByName: a.allocatedByName?.trim() || null,
      allocatedAt: a.allocatedAt.toISOString(),
    }));
    return {
      ...this.toSummary(row, invoiceRows),
      networkReasonCode: row.networkReasonCode,
      cardBrand: row.cardBrand,
      cardLast4: row.cardLast4,
      chargeId: row.stripeChargeId,
      version: row.version,
      fundsWithdrawnAt: row.fundsWithdrawnAt?.toISOString() ?? null,
      fundsReinstatedAt: row.fundsReinstatedAt?.toISOString() ?? null,
      invoices: invoiceRows.map(toInvoice),
      allocations,
    };
  }

  /** Cases per view, over every case. */
  private async countViews(): Promise<DisputeDeskCounts> {
    const count = (condition: SQL | undefined) =>
      sql<number>`count(*) filter (where ${condition ?? sql`true`})::int`;
    const [row] = await this.db
      .select({
        needs_allocation: count(viewCondition("needs_allocation")),
        open: count(viewCondition("open")),
        under_review: count(viewCondition("under_review")),
        closed: count(viewCondition("closed")),
        all: sql<number>`count(*)::int`,
      })
      .from(disputeCase);
    return {
      needs_allocation: row?.needs_allocation ?? 0,
      open: row?.open ?? 0,
      under_review: row?.under_review ?? 0,
      closed: row?.closed ?? 0,
      all: row?.all ?? 0,
    };
  }

  private searchCondition(q: string): SQL | undefined {
    const pattern = `%${escapeLike(q)}%`;
    const onInvoice = this.db
      .select({ one: sql`1` })
      .from(disputeCaseCandidate)
      .innerJoin(payment, eq(payment.id, disputeCaseCandidate.paymentId))
      .innerJoin(lot, eq(lot.id, payment.lotId))
      .innerJoin(legalEntity, eq(legalEntity.id, payment.sellerLegalEntityId))
      .leftJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, payment.buyerId))
      .where(
        and(
          eq(disputeCaseCandidate.caseId, disputeCase.id),
          or(
            ilike(lot.title, pattern),
            ilike(legalEntity.displayName, pattern),
            ilike(bidIdentityDirectory.name, pattern),
            ilike(bidIdentityDirectory.email, pattern),
          ),
        ),
      );
    return or(ilike(disputeCase.stripeDisputeId, pattern), exists(onInvoice));
  }

  /** The invoices of each case: those its charge paid and those it was allocated to. */
  private async invoicesByCase(caseIds: string[]): Promise<Map<string, InvoiceRow[]>> {
    const byCase = new Map<string, InvoiceRow[]>();
    if (caseIds.length === 0) return byCase;
    const [candidates, allocations] = await Promise.all([
      this.db
        .select({ caseId: disputeCaseCandidate.caseId, paymentId: disputeCaseCandidate.paymentId })
        .from(disputeCaseCandidate)
        .where(inArray(disputeCaseCandidate.caseId, caseIds)),
      this.db
        .select({ caseId: disputeAllocation.caseId, paymentId: disputeAllocation.paymentId })
        .from(disputeAllocation)
        .where(inArray(disputeAllocation.caseId, caseIds)),
    ]);
    const paymentIdsByCase = new Map<string, Set<string>>();
    for (const link of [...candidates, ...allocations]) {
      const set = paymentIdsByCase.get(link.caseId) ?? new Set<string>();
      set.add(link.paymentId);
      paymentIdsByCase.set(link.caseId, set);
    }
    const paymentIds = [...new Set([...paymentIdsByCase.values()].flatMap((s) => [...s]))];
    if (paymentIds.length === 0) return byCase;
    const invoices = await this.db
      .select(INVOICE_COLUMNS)
      .from(payment)
      .innerJoin(lot, eq(lot.id, payment.lotId))
      .innerJoin(legalEntity, eq(legalEntity.id, payment.sellerLegalEntityId))
      .leftJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, payment.buyerId))
      .where(inArray(payment.id, paymentIds))
      .orderBy(asc(payment.createdAt), asc(payment.id));
    for (const [caseId, ids] of paymentIdsByCase) {
      byCase.set(
        caseId,
        invoices.filter((i) => ids.has(i.paymentId)),
      );
    }
    return byCase;
  }

  private toSummary(row: CaseRow, invoices: InvoiceRow[]): DisputeDeskCaseSummary {
    const only = invoices.length === 1 ? invoices[0] : undefined;
    const buyer = invoices[0];
    const awaiting =
      row.allocationState === "needs_allocation" &&
      !DISPUTE_STATUSES_WITHOUT_LOSS.includes(row.status);
    return {
      id: row.id,
      stripeDisputeId: row.stripeDisputeId,
      status: row.status,
      allocationState: row.allocationState as DisputeDeskCaseSummary["allocationState"],
      awaitingAllocation: awaiting,
      amountPence: row.amountPence,
      currency: row.currency,
      reason: row.reason,
      dueBy: row.dueBy?.toISOString() ?? null,
      evidenceSubmitted: row.evidenceSubmitted,
      openedAt: row.stripeCreatedAt.toISOString(),
      closedAt: row.closedAt?.toISOString() ?? null,
      invoiceCount: invoices.length,
      lotTitle: only?.lotTitle ?? null,
      buyerId: buyer?.buyerId ?? null,
      buyerLabel: buyer ? buyerLabel(buyer) : null,
      sellerNames: [...new Set(invoices.map((i) => i.sellerName))],
    };
  }
}
