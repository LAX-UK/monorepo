import type { UserNotification } from "@auction/types";
import type { INotificationPreferenceReader } from "../interfaces/notification-preference.repository.js";
import type {
  CreateNotificationRow,
  INotificationWriteRepository,
} from "../interfaces/notification-write.repository.js";

/**
 * Drops a notice whose app switch the person turned off, for the notice types it is told to
 * govern, then writes the rest. Other types pass straight through, as they always have, so adding
 * a switch for one kind of notice never changes how another is delivered.
 */
export class PreferenceAwareNotificationWriter implements INotificationWriteRepository {
  private readonly governed: ReadonlySet<string>;

  constructor(
    private readonly inner: INotificationWriteRepository,
    private readonly preferences: Pick<INotificationPreferenceReader, "isChannelEnabled">,
    governedTypes: readonly string[],
  ) {
    this.governed = new Set(governedTypes);
  }

  async createMany(rows: CreateNotificationRow[]): Promise<UserNotification[]> {
    const delivered: CreateNotificationRow[] = [];
    for (const row of rows) {
      const wanted =
        !this.governed.has(row.type) ||
        (await this.preferences.isChannelEnabled(row.userId, row.type, "in_app"));
      if (wanted) delivered.push(row);
    }
    return this.inner.createMany(delivered);
  }
}
