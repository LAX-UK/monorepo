import type { WatchlistReminderRow } from "@auction/persistence/interfaces";
import type { WatchlistReminderBody } from "@auction/validators";
import type { UserRouteOutcome } from "./user-route-http.js";

/** A watched lot's reminder as the Watching page reads it. */
export type WatchlistReminderView = Omit<WatchlistReminderRow, "sentAt" | "updatedAt"> & {
  /** When it was sent; `null` while it is still to come. */
  sentAt: string | null;
};

/** A person's reminders on the lots they watch: their own, whichever account they act for. */
export interface IUserWatchlistRemindersHttpApplicationService {
  list(userId: string): Promise<UserRouteOutcome<WatchlistReminderView[]>>;
  set(
    userId: string,
    lotId: string,
    body: WatchlistReminderBody,
  ): Promise<UserRouteOutcome<WatchlistReminderView>>;
  clear(userId: string, lotId: string): Promise<UserRouteOutcome<never>>;
}
