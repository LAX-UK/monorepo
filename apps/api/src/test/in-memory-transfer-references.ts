import type {
  IPaymentTransferReferenceStore,
  TransferReferenceRecord,
} from "@auction/persistence/interfaces";

/** Keeps each intent's first-seen reference, as the real store does. */
export class InMemoryTransferReferences implements IPaymentTransferReferenceStore {
  readonly rows = new Map<string, TransferReferenceRecord>();
  writes = 0;

  async remember(record: TransferReferenceRecord): Promise<void> {
    this.writes += 1;
    if (!this.rows.has(record.stripePaymentIntentId)) {
      this.rows.set(record.stripePaymentIntentId, record);
    }
  }

  async findByPaymentIntent(id: string): Promise<TransferReferenceRecord | null> {
    return this.rows.get(id) ?? null;
  }

  async listForCustomer(customerId: string, limit: number): Promise<TransferReferenceRecord[]> {
    return [...this.rows.values()]
      .filter((r) => r.stripeCustomerId === customerId)
      .reverse()
      .slice(0, limit);
  }
}
