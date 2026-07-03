import type { ITransactionRunner } from "@auction/persistence";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IUserRepository } from "./interfaces/repositories.js";

export class UserService {
  constructor(
    private readonly users: IUserRepository,
    private readonly transactionRunner: ITransactionRunner,
    private readonly domainEvents: DomainEventPublisher,
  ) {}

  async requestAccountDeletion(userId: string): Promise<void> {
    await this.transactionRunner.runInTransaction(async (tx) => {
      await this.users.markDeletionRequested(userId, tx);
      await this.domainEvents.publish(tx, {
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
