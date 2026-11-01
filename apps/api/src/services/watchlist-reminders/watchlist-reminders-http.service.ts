import type {
  IWatchlistReminderRepository,
  WatchlistReminderRow,
} from "@auction/persistence/interfaces";
import type { WatchlistReminderBody } from "@auction/validators";
import type { UserRouteOutcome } from "../interfaces/user-routes/user-route-http.js";
import type {
  IUserWatchlistRemindersHttpApplicationService,
  WatchlistReminderView,
} from "../interfaces/user-routes/user-watchlist-reminders-http.js";

function toView(row: WatchlistReminderRow): WatchlistReminderView {
  return {
    lotId: row.lotId,
    kind: row.kind,
    note: row.note,
    sentAt: row.sentAt?.toISOString() ?? null,
  };
}

/**
 * Sets, reads and clears reminders on the person's own watched lots. A reminder can only sit on
 * a lot they watch; asking for another answers as if the lot were not on their list.
 */
export class WatchlistRemindersHttpService
  implements IUserWatchlistRemindersHttpApplicationService
{
  constructor(private readonly reminders: IWatchlistReminderRepository) {}

  async list(userId: string): Promise<UserRouteOutcome<WatchlistReminderView[]>> {
    return { kind: "ok", data: (await this.reminders.listForUser(userId)).map(toView) };
  }

  async set(
    userId: string,
    lotId: string,
    body: WatchlistReminderBody,
  ): Promise<UserRouteOutcome<WatchlistReminderView>> {
    const row = await this.reminders.set(userId, lotId, { kind: body.kind, note: body.note });
    if (!row) {
      return {
        kind: "err",
        error: {
          message: "Watch this lot first, then set a reminder.",
          status: 404,
          code: "not_watching",
        },
      };
    }
    return { kind: "ok", data: toView(row) };
  }

  async clear(userId: string, lotId: string): Promise<UserRouteOutcome<never>> {
    await this.reminders.clear(userId, lotId);
    return { kind: "no_content" };
  }
}
