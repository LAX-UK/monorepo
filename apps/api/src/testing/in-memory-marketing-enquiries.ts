import type {
  IMarketingEnquiryRepository,
  MarketingEnquiryRecord,
  NewMarketingEnquiry,
} from "@auction/persistence/interfaces";

/** Contact enquiries in memory, with the new-to-handled rule. */
export class InMemoryMarketingEnquiries implements IMarketingEnquiryRepository {
  readonly rows: MarketingEnquiryRecord[] = [];

  constructor(private readonly now: () => Date = () => new Date("2026-07-27T10:00:00.000Z")) {}

  async createInTransaction(_tx: unknown, input: NewMarketingEnquiry) {
    const record: MarketingEnquiryRecord = {
      id: `3f2a9c1e-7b4d-4e0a-9d1f-${String(this.rows.length + 1).padStart(12, "0")}`,
      topic: input.topic,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      message: input.message,
      sourcePage: input.sourcePage ?? null,
      status: "new",
      createdAt: this.now(),
      handledAt: null,
      handledByUserId: null,
    };
    this.rows.push(record);
    return record;
  }

  async findById(id: string) {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async markHandledInTransaction(_tx: unknown, id: string, userId: string, at: Date) {
    const row = this.rows.find((r) => r.id === id && r.status === "new");
    if (!row) return null;
    row.status = "handled";
    row.handledAt = at;
    row.handledByUserId = userId;
    return row;
  }
}
