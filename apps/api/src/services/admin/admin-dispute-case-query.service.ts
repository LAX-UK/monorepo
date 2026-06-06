import type { Database } from "@auction/db";
import { legalEntity, lot, payment, user } from "@auction/db/schema";
import {
  type AdminDisputeCaseRow,
  type DisputeCaseListFilter,
  type DisputeDomainEventInput,
  countOpenDisputeCases,
  filterDisputeCasesByChip,
  foldDisputeCasesFromEvents,
  summarizeDisputeCases,
} from "@auction/types";
import { inArray } from "drizzle-orm";
import type {
  IAdminDisputeCaseQueryService,
  IAdminDomainEventQueryService,
} from "../interfaces/admin-routes.js";

const MAX_DISPUTE_EVENTS_FOR_FOLD = 5_000;
const CASES_CACHE_TTL_MS = 30_000;

type CasesCache = {
  expiresAt: number;
  promise: Promise<AdminDisputeCaseRow[]>;
};

export class AdminDisputeCaseQueryService implements IAdminDisputeCaseQueryService {
  private casesCache: CasesCache | null = null;

  constructor(
    private readonly domainEvents: IAdminDomainEventQueryService,
    private readonly db: Database,
  ) {}

  async listCases(input: {
    limit: number;
    offset: number;
    status?: DisputeCaseListFilter;
  }): Promise<{
    rows: AdminDisputeCaseRow[];
    hasNextPage: boolean;
    summary: ReturnType<typeof summarizeDisputeCases>;
  }> {
    const all = await this.loadAllCases();
    const summary = summarizeDisputeCases(all);
    const filtered = filterDisputeCasesByChip(all, input.status);
    const slice = filtered.slice(input.offset, input.offset + input.limit + 1);
    const hasNextPage = slice.length > input.limit;
    const rows = hasNextPage ? slice.slice(0, input.limit) : slice;
    return { rows, hasNextPage, summary };
  }

  async countOpenCases(): Promise<number> {
    const all = await this.loadAllCases();
    return countOpenDisputeCases(all);
  }

  private loadAllCases(): Promise<AdminDisputeCaseRow[]> {
    const now = Date.now();
    if (this.casesCache && this.casesCache.expiresAt > now) {
      return this.casesCache.promise;
    }

    const promise = this.loadAllCasesUncached().catch((err) => {
      if (this.casesCache?.promise === promise) {
        this.casesCache = null;
      }
      throw err;
    });

    this.casesCache = { expiresAt: now + CASES_CACHE_TTL_MS, promise };
    return promise;
  }

  private async loadAllCasesUncached(): Promise<AdminDisputeCaseRow[]> {
    const events = await this.domainEvents.listRedacted({
      limit: MAX_DISPUTE_EVENTS_FOR_FOLD,
      offset: 0,
      eventTypePrefix: "payment.dispute",
      includePii: false,
    });

    const inputs: DisputeDomainEventInput[] = events.map((e) => ({
      aggregateId: e.aggregateId,
      eventType: e.eventType,
      payload: (e.payload as Record<string, unknown>) ?? {},
      occurredAt: e.occurredAt,
    }));

    const folded = foldDisputeCasesFromEvents(inputs);
    const withTimeline = this.attachTimeline(folded, events);
    return this.enrichCases(withTimeline);
  }

  private attachTimeline(
    cases: AdminDisputeCaseRow[],
    events: Awaited<ReturnType<IAdminDomainEventQueryService["listRedacted"]>>,
  ): AdminDisputeCaseRow[] {
    const byDisputeId = new Map<string, typeof events>();
    for (const event of events) {
      const payload = (event.payload as Record<string, unknown>) ?? {};
      const disputeId =
        typeof payload.stripeDisputeId === "string" ? payload.stripeDisputeId : null;
      if (!disputeId) continue;
      const bucket = byDisputeId.get(disputeId) ?? [];
      bucket.push(event);
      byDisputeId.set(disputeId, bucket);
    }

    return cases.map((row) => {
      const group = byDisputeId.get(row.stripeDisputeId) ?? [];
      const timelineEvents = [...group]
        .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
        .map((e) => ({
          id: String(e.id),
          eventType: e.eventType,
          payload: (e.payload as Record<string, unknown>) ?? {},
          occurredAt: e.occurredAt.toISOString(),
        }));
      return { ...row, timelineEvents };
    });
  }

  private async enrichCases(cases: AdminDisputeCaseRow[]): Promise<AdminDisputeCaseRow[]> {
    if (cases.length === 0) return cases;

    const paymentIds = [...new Set(cases.map((c) => c.paymentId))];
    const paymentRows = await this.db
      .select({
        id: payment.id,
        lotId: payment.lotId,
        buyerId: payment.buyerId,
        sellerLegalEntityId: payment.sellerLegalEntityId,
      })
      .from(payment)
      .where(inArray(payment.id, paymentIds));

    const paymentById = new Map(paymentRows.map((p) => [p.id, p] as const));
    const lotIds = [...new Set(paymentRows.map((p) => p.lotId))];
    const buyerIds = [...new Set(paymentRows.map((p) => p.buyerId))];
    const sellerIds = [
      ...new Set([
        ...cases.map((c) => c.sellerLegalEntityId),
        ...paymentRows.map((p) => p.sellerLegalEntityId),
      ]),
    ].filter(Boolean);

    const [lotRows, buyerRows, sellerRows] = await Promise.all([
      lotIds.length > 0
        ? this.db.select({ id: lot.id, title: lot.title }).from(lot).where(inArray(lot.id, lotIds))
        : Promise.resolve([]),
      buyerIds.length > 0
        ? this.db
            .select({ id: user.id, name: user.name, email: user.email })
            .from(user)
            .where(inArray(user.id, buyerIds))
        : Promise.resolve([]),
      sellerIds.length > 0
        ? this.db
            .select({ id: legalEntity.id, displayName: legalEntity.displayName })
            .from(legalEntity)
            .where(inArray(legalEntity.id, sellerIds))
        : Promise.resolve([]),
    ]);

    const lotById = new Map(lotRows.map((l) => [l.id, l.title] as const));
    const buyerById = new Map(
      buyerRows.map((b) => [b.id, b.name?.trim() || b.email || null] as const),
    );
    const sellerById = new Map(sellerRows.map((s) => [s.id, s.displayName] as const));

    return cases.map((row) => {
      const pay = paymentById.get(row.paymentId);
      const lotId = pay?.lotId;
      const buyerId = pay?.buyerId;
      const sellerId = pay?.sellerLegalEntityId ?? row.sellerLegalEntityId;
      return {
        ...row,
        ...(lotId ? { lotId } : {}),
        ...(lotId ? { lotTitle: lotById.get(lotId) ?? lotId } : {}),
        ...(buyerId ? { buyerId } : {}),
        ...(buyerId ? { buyerLabel: buyerById.get(buyerId) ?? null } : {}),
        sellerDisplayName: sellerById.get(sellerId) ?? null,
      };
    });
  }
}
