import type { UserNotification } from "@auction/types";
import type { INotificationAccountMuteReader } from "../interfaces/notification-account-mute.repository.js";
import type {
  CreateNotificationRow,
  INotificationWriteRepository,
} from "../interfaces/notification-write.repository.js";

/**
 * Drops notifications about an account the recipient has muted, then writes the rest. Every
 * in-app writer goes through this, so a mute holds whichever producer raised the notice.
 * Personal notices (no account) are never muted.
 */
export class MuteAwareNotificationWriter implements INotificationWriteRepository {
  constructor(
    private readonly inner: INotificationWriteRepository,
    private readonly mutes: INotificationAccountMuteReader,
  ) {}

  async createMany(rows: CreateNotificationRow[]): Promise<UserNotification[]> {
    const mutedByUser = new Map<string, Set<string>>();
    for (const row of rows) {
      if (row.legalEntityId == null || mutedByUser.has(row.userId)) continue;
      mutedByUser.set(row.userId, new Set(await this.mutes.listMutedAccountIds(row.userId)));
    }
    const delivered = rows.filter(
      (row) => row.legalEntityId == null || !mutedByUser.get(row.userId)?.has(row.legalEntityId),
    );
    return this.inner.createMany(delivered);
  }
}
