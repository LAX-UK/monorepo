import {
  ENQUIRY_STATUSES,
  type EnquiryRoutingRule,
  OPEN_ENQUIRY_STATUSES,
  PRIVATE_SALE_ENQUIRY_INTENTS,
  enquiryViewCriteria,
} from "@auction/domain";
import type {
  EnquiryAttachmentFile,
  EnquiryAttachmentRecord,
  EnquiryListFilter,
  EnquiryNoteRecord,
  EnquiryStatusCounts,
  IEnquiryNoteRepository,
  IEnquiryRoutingRepository,
  IMarketingEnquiryRepository,
  MarketingEnquiryChange,
  MarketingEnquiryDetailRecord,
  MarketingEnquiryRecord,
  NewMarketingEnquiry,
} from "@auction/persistence/interfaces";

/** Enquiries in memory, with the version check and the open-to-closed rule. */
export class InMemoryMarketingEnquiries implements IMarketingEnquiryRepository {
  readonly rows: MarketingEnquiryRecord[] = [];
  readonly privateSale = new Map<string, NewMarketingEnquiry["privateSale"]>();
  /** Attachments by enquiry id, with the file each one points at. */
  readonly attachments = new Map<string, Array<EnquiryAttachmentRecord & EnquiryAttachmentFile>>();

  constructor(private readonly now: () => Date = () => new Date("2026-07-27T10:00:00.000Z")) {}

  async createInTransaction(_tx: unknown, input: NewMarketingEnquiry) {
    const record: MarketingEnquiryRecord = {
      id: `3f2a9c1e-7b4d-4e0a-9d1f-${String(this.rows.length + 1).padStart(12, "0")}`,
      reference: `E-${1001 + this.rows.length}`,
      intent: input.intent,
      topic: input.topic,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      message: input.message,
      sourcePage: input.sourcePage ?? null,
      status: "new",
      closeReason: null,
      departmentSlug: input.departmentSlug ?? null,
      assignedToUserId: input.assignedToUserId ?? null,
      userId: input.userId ?? null,
      legalEntityId: input.legalEntityId ?? null,
      marketingOptIn: input.marketingOptIn,
      version: 1,
      createdAt: this.now(),
      handledAt: null,
      handledByUserId: null,
      awaitingReplySince: null,
    };
    this.rows.push(record);
    this.privateSale.set(record.id, input.privateSale);
    return record;
  }

  async findById(id: string) {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async findByRef(ref: string): Promise<MarketingEnquiryDetailRecord | null> {
    const row = this.rows.find((r) => r.id === ref || r.reference === ref);
    if (!row) return null;
    return {
      ...row,
      privateSale: this.privateSale.get(row.id) ?? null,
      attachments: (this.attachments.get(row.id) ?? []).map(
        ({ key: _k, contentType: _c, ...a }) => a,
      ),
    };
  }

  async findAttachmentFile(enquiryId: string, attachmentId: string) {
    const found = this.attachments.get(enquiryId)?.find((a) => a.id === attachmentId);
    return found ? { key: found.key, contentType: found.contentType } : null;
  }

  async countByStatus(filter: EnquiryListFilter): Promise<EnquiryStatusCounts> {
    const { status: _s, afterId: _a, ...rest } = filter;
    const counts = Object.fromEntries(ENQUIRY_STATUSES.map((s) => [s, 0])) as EnquiryStatusCounts;
    for (const row of this.matching(rest)) counts[row.status] += 1;
    return counts;
  }

  async list(filter: EnquiryListFilter) {
    const criteria = enquiryViewCriteria(filter.view);
    const matches = this.matching(filter);
    const oldestFirst = filter.sort ? filter.sort === "oldest" : criteria.order === "oldest_first";
    const direction = oldestFirst ? 1 : -1;
    const sorted = [...matches].sort(
      (a, b) =>
        direction * (a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)),
    );
    const anchor = sorted.findIndex((r) => r.id === filter.afterId);
    const rest = filter.afterId && anchor >= 0 ? sorted.slice(anchor + 1) : sorted;
    return rest.slice(0, filter.limit + 1);
  }

  private matching(filter: EnquiryListFilter) {
    const criteria = enquiryViewCriteria(filter.view);
    const { scope } = filter;
    const isPrivate = (r: MarketingEnquiryRecord) =>
      (PRIVATE_SALE_ENQUIRY_INTENTS as readonly string[]).includes(r.intent);
    return this.rows.filter((r) => {
      const visible = isPrivate(r)
        ? scope.readsPrivateSale
        : scope.readsGeneral || r.assignedToUserId === scope.viewerUserId;
      if (!visible) return false;
      if (criteria.statuses && !criteria.statuses.includes(r.status)) return false;
      if (criteria.assignee === "viewer" && r.assignedToUserId !== scope.viewerUserId) return false;
      if (criteria.assignee === "nobody" && r.assignedToUserId !== null) return false;
      if (criteria.privateSaleOnly && !isPrivate(r)) return false;
      if (filter.intent && r.intent !== filter.intent) return false;
      if (filter.departmentSlug && r.departmentSlug !== filter.departmentSlug) return false;
      if (filter.status && r.status !== filter.status) return false;
      if (filter.assignee === "unassigned" && r.assignedToUserId !== null) return false;
      if (
        filter.assignee &&
        filter.assignee !== "unassigned" &&
        r.assignedToUserId !== filter.assignee
      ) {
        return false;
      }
      if (filter.search) {
        const needle = filter.search.toLowerCase();
        const work = this.privateSale.get(r.id);
        const haystack = [r.name, r.email, r.reference, work?.artist, work?.title];
        if (!haystack.some((v) => v?.toLowerCase().includes(needle))) return false;
      }
      return true;
    });
  }

  async updateInTransaction(
    _tx: unknown,
    id: string,
    expectedVersion: number,
    change: MarketingEnquiryChange,
  ) {
    const row = this.rows.find((r) => r.id === id && r.version === expectedVersion);
    if (!row) return null;
    if (change.status !== undefined) row.status = change.status;
    if (change.closeReason !== undefined) row.closeReason = change.closeReason;
    if (change.assignedToUserId !== undefined) row.assignedToUserId = change.assignedToUserId;
    if (change.closed !== undefined) {
      row.handledAt = change.closed?.at ?? null;
      row.handledByUserId = change.closed?.byUserId ?? null;
    }
    if (change.clearsAwaitingReply) row.awaitingReplySince = null;
    row.version += 1;
    return row;
  }

  async markHandledInTransaction(_tx: unknown, id: string, userId: string, at: Date) {
    const row = this.rows.find((r) => r.id === id && OPEN_ENQUIRY_STATUSES.includes(r.status));
    if (!row) return null;
    row.status = "closed";
    row.handledAt = at;
    row.handledByUserId = userId;
    row.awaitingReplySince = null;
    row.version += 1;
    return row;
  }
}

export class InMemoryEnquiryNotes implements IEnquiryNoteRepository {
  readonly rows: EnquiryNoteRecord[] = [];

  async addInTransaction(
    _tx: unknown,
    input: { enquiryId: string; authorUserId: string; body: string },
  ) {
    const note: EnquiryNoteRecord = {
      id: `note-${this.rows.length + 1}`,
      ...input,
      createdAt: new Date("2026-07-27T11:00:00.000Z"),
    };
    this.rows.push(note);
    return note;
  }

  async listForEnquiry(enquiryId: string) {
    return this.rows.filter((n) => n.enquiryId === enquiryId);
  }
}

export class InMemoryEnquiryRouting implements IEnquiryRoutingRepository {
  rules: EnquiryRoutingRule[] = [];

  async listRules() {
    return [...this.rules];
  }

  async listRulesInTransaction() {
    return [...this.rules];
  }

  async replaceRulesInTransaction(_tx: unknown, rules: readonly EnquiryRoutingRule[]) {
    this.rules = rules.map((rule) => ({ ...rule }));
  }
}
