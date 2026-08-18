import type { ITransactionRunner } from "@auction/persistence/interfaces";
import type { IUserRepository } from "@auction/persistence/interfaces";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { IIdentityProfileClient } from "./interfaces/identity-issuer-client.js";

export class UserService {
  constructor(
    private readonly users: IUserRepository,
    private readonly transactionRunner: ITransactionRunner,
    private readonly domainEvents: IDomainEventSink,
    private readonly identity?: Pick<IIdentityProfileClient, "markDeletionRequested">,
  ) {}

  async requestAccountDeletion(userId: string): Promise<void> {
    if (!this.identity) throw new Error("Identity deletion marker is not configured");
    await this.identity.markDeletionRequested(userId);
    await this.transactionRunner.runInTransaction(async (tx) => {
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
