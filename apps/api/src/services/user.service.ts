import type { Database } from "@auction/db";
import { user as userTable } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IUserRepository } from "./interfaces/repositories.js";

export class UserService {
  constructor(
    private readonly users: IUserRepository,
    private readonly db?: Database,
    private readonly domainEvents?: DomainEventPublisher,
  ) {}

  async requestAccountDeletion(userId: string): Promise<void> {
    if (!this.db || !this.domainEvents) {
      throw new Error("account_deletion_not_configured");
    }
    const domainEvents = this.domainEvents;
    await this.db.transaction(async (tx) => {
      await tx
        .update(userTable)
        .set({ deletionRequestedAt: new Date(), updatedAt: new Date() })
        .where(eq(userTable.id, userId));
      await domainEvents.publish(tx, {
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
