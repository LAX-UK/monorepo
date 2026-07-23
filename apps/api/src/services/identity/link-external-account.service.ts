import type { Database } from "@auction/db";
import type { IExternalAccountRepository } from "@auction/persistence/interfaces";
import type { IDomainEventSink } from "../domain-event-sink.js";

export type LinkExternalAccountInput = {
  userId: string;
  provider: string;
  externalId: string;
  email?: string | null;
  metadata?: Record<string, unknown>;
};

export class LinkExternalAccountService {
  constructor(
    private readonly externalAccounts: IExternalAccountRepository,
    private readonly domainEventSink: IDomainEventSink | null,
  ) {}

  async linkInTransaction(
    tx: Database,
    input: LinkExternalAccountInput,
  ): Promise<{ linked: boolean }> {
    const { inserted, row } = await this.externalAccounts.upsert(input, tx);
    if (!inserted || !this.domainEventSink) {
      return { linked: inserted };
    }

    await this.domainEventSink.withTx(tx).publish({
      aggregateType: "user",
      aggregateId: input.userId,
      eventType: "user.linked_external",
      payload: {
        userId: input.userId,
        provider: input.provider,
        externalId: input.externalId,
        linkedAt: row.linkedAt.toISOString(),
      },
      actorUserId: null,
    });

    return { linked: true };
  }
}
