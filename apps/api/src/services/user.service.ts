import type { ITransactionRunner } from "@auction/persistence";
import type { IUserRepository } from "@auction/persistence";
import type { IDomainEventSink } from "./domain-event-sink.js";

export class UserService {
  constructor(
    private readonly users: IUserRepository,
    private readonly transactionRunner: ITransactionRunner,
    private readonly domainEvents: IDomainEventSink,
  ) {}

  async requestAccountDeletion(userId: string): Promise<void> {
    await this.transactionRunner.runInTransaction(async (tx) => {
      await this.users.markDeletionRequested(userId, tx);
      await this.domainEvents.withTx(tx).publish({
        aggregateType: "user",
        aggregateId: userId,
        eventType: "user.deletion_requested",
        payload: { userId },
        actorUserId: userId,
      });
    });
  }

  getById(id: string) {
    return this.users.findById(id);
  }

  listPublicArtists(params: { limit: number; offset: number }) {
    return this.users.listPublicProfiles(params);
  }

  /** dismiss the first-time acting-context tooltip. */
  markActingContextTooltipSeen(userId: string) {
    return this.users.updateActingContextTooltipSeen(userId, true);
  }
}
