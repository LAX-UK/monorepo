import type { Database } from "@auction/db";
import { legalEntity, legalEntityMember, notificationAccountMute } from "@auction/db/schema";
import { and, asc, eq, isNotNull, isNull, ne } from "drizzle-orm";
import type {
  INotificationAccountMuteStore,
  NotificationAccountMuteRecord,
} from "../interfaces/notification-account-mute.repository.js";

export class DrizzleNotificationAccountMuteRepository implements INotificationAccountMuteStore {
  constructor(private readonly db: Database) {}

  async listMutedAccountIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ legalEntityId: notificationAccountMute.legalEntityId })
      .from(notificationAccountMute)
      .where(eq(notificationAccountMute.userId, userId));
    return rows.map((r) => r.legalEntityId);
  }

  async listForUser(userId: string): Promise<NotificationAccountMuteRecord[]> {
    return this.db
      .select({
        legalEntityId: notificationAccountMute.legalEntityId,
        displayName: legalEntity.displayName,
        mutedAt: notificationAccountMute.createdAt,
      })
      .from(notificationAccountMute)
      .innerJoin(legalEntity, eq(legalEntity.id, notificationAccountMute.legalEntityId))
      .where(eq(notificationAccountMute.userId, userId))
      .orderBy(asc(legalEntity.displayName));
  }

  async isMemberOfOrganisation(userId: string, legalEntityId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: legalEntityMember.id })
      .from(legalEntityMember)
      .innerJoin(legalEntity, eq(legalEntity.id, legalEntityMember.legalEntityId))
      .where(
        and(
          eq(legalEntityMember.legalEntityId, legalEntityId),
          eq(legalEntityMember.userId, userId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
          ne(legalEntity.kind, "individual"),
        ),
      )
      .limit(1);
    return row != null;
  }

  async mute(userId: string, legalEntityId: string): Promise<void> {
    await this.db
      .insert(notificationAccountMute)
      .values({ userId, legalEntityId })
      .onConflictDoNothing();
  }

  async unmute(userId: string, legalEntityId: string): Promise<boolean> {
    const removed = await this.db
      .delete(notificationAccountMute)
      .where(
        and(
          eq(notificationAccountMute.userId, userId),
          eq(notificationAccountMute.legalEntityId, legalEntityId),
        ),
      )
      .returning({ userId: notificationAccountMute.userId });
    return removed.length > 0;
  }
}
