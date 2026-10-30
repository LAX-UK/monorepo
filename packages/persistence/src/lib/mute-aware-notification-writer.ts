import { notificationIsMutable, notificationSilencedByMute } from "@auction/domain";
import type { UserNotification } from "@auction/types";
import type { INotificationAccountMuteReader } from "../interfaces/notification-account-mute.repository.js";
import type {
  CreateNotificationRow,
  INotificationWriteRepository,
} from "../interfaces/notification-write.repository.js";

/**
 * Drops informational notifications about an account the recipient has muted, then writes the
 * rest. Every in-app writer goes through this, so a mute holds whichever producer raised the
 * notice. Required notices (see `NOTIFICATION_ALWAYS_DELIVERED_TYPES`) and personal notices are
 * always written.
 */
export class MuteAwareNotificationWriter implements INotificationWriteRepository {
  constructor(
    private readonly inner: INotificationWriteRepository,
    private readonly mutes: INotificationAccountMuteReader,
  ) {}

  async createMany(rows: CreateNotificationRow[]): Promise<UserNotification[]> {
    const mutedByUser = new Map<string, Set<string>>();
    for (const row of rows) {
      // Only rows a mute could silence need the recipient's mutes.
      const mutable = row.legalEntityId != null && notificationIsMutable(row.type);
      if (!mutable || mutedByUser.has(row.userId)) continue;
      mutedByUser.set(row.userId, new Set(await this.mutes.listMutedAccountIds(row.userId)));
    }
    const delivered = rows.filter(
      (row) => !notificationSilencedByMute(row, mutedByUser.get(row.userId) ?? new Set()),
    );
    return this.inner.createMany(delivered);
  }
}
