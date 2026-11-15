import type { Database } from "@auction/db";
import type {
  INotificationWriteRepository,
  IUserRepository,
} from "@auction/persistence/interfaces";
import { MuteAwareNotificationWriter } from "@auction/persistence/lib";
import {
  DrizzleNotificationAccountMuteRepository,
  DrizzleNotificationWriteRepository,
  DrizzleUserRepository,
} from "@auction/persistence/repositories";

/**
 * Stores bound to a caller's transaction, so what they write commits or rolls back with it.
 * Shared by every service that writes notices inside another change's transaction.
 */

/** The user store for a transaction. */
export function usersFor(db: Database): Pick<IUserRepository, "findById"> {
  return new DrizzleUserRepository(db);
}

/** The notification writer for a transaction; it skips accounts the person has muted. */
export function notificationWriterFor(db: Database): INotificationWriteRepository {
  return new MuteAwareNotificationWriter(
    new DrizzleNotificationWriteRepository(db),
    new DrizzleNotificationAccountMuteRepository(db),
  );
}
