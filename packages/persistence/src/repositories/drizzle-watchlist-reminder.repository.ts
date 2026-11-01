import type { Database } from "@auction/db";
import { lot, watchlist, watchlistReminder } from "@auction/db/schema";
import type { WatchedLotReminderKind } from "@auction/domain";
import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import type {
  IWatchlistReminderRepository,
  PendingWatchlistReminder,
  WatchlistReminderRow,
} from "../interfaces/watchlist-reminder.repository.js";

type ReminderRow = typeof watchlistReminder.$inferSelect;

function toRow(row: ReminderRow): WatchlistReminderRow {
  return {
    lotId: row.lotId,
    kind: row.kind as WatchedLotReminderKind,
    note: row.note,
    sentAt: row.sentAt,
    updatedAt: row.updatedAt,
  };
}

const CLOSED = new Set(["ended", "cancelled", "voided"]);

/** Reminders in `watchlist_reminder`, one per watched lot, removed with it. */
export class DrizzleWatchlistReminderRepository implements IWatchlistReminderRepository {
  constructor(private readonly db: Database) {}

  async listForUser(userId: string): Promise<WatchlistReminderRow[]> {
    const rows = await this.db
      .select()
      .from(watchlistReminder)
      .where(eq(watchlistReminder.userId, userId));
    return rows.map(toRow);
  }

  async set(
    userId: string,
    lotId: string,
    reminder: { kind: WatchedLotReminderKind; note: string | null },
  ): Promise<WatchlistReminderRow | null> {
    const [watched] = await this.db
      .select({ id: watchlist.id })
      .from(watchlist)
      .where(and(eq(watchlist.userId, userId), eq(watchlist.lotId, lotId)))
      .limit(1);
    if (!watched) return null;
    const values = {
      kind: reminder.kind,
      note: reminder.note,
      sentAt: null,
      updatedAt: new Date(),
    };
    const [row] = await this.db
      .insert(watchlistReminder)
      .values({ watchlistId: watched.id, userId, lotId, ...values })
      .onConflictDoUpdate({ target: watchlistReminder.watchlistId, set: values })
      .returning();
    return row ? toRow(row) : null;
  }

  async clear(userId: string, lotId: string): Promise<void> {
    await this.db
      .delete(watchlistReminder)
      .where(and(eq(watchlistReminder.userId, userId), eq(watchlistReminder.lotId, lotId)));
  }

  async listPending(now: Date, limit: number): Promise<PendingWatchlistReminder[]> {
    const hour = 60 * 60 * 1000;
    const dueBy = (
      kind: WatchedLotReminderKind,
      column: typeof lot.startTime | typeof lot.endTime,
      until: Date,
    ) => and(eq(watchlistReminder.kind, kind), lte(column, until));
    const rows = await this.db
      .select({
        watchlistId: watchlistReminder.watchlistId,
        userId: watchlistReminder.userId,
        lotId: watchlistReminder.lotId,
        kind: watchlistReminder.kind,
        note: watchlistReminder.note,
        lotTitle: lot.title,
        startTime: lot.startTime,
        endTime: lot.endTime,
        status: lot.status,
      })
      .from(watchlistReminder)
      .innerJoin(lot, eq(lot.id, watchlistReminder.lotId))
      .where(
        and(
          isNull(watchlistReminder.sentAt),
          or(
            // A closed lot's reminders are picked up so they can be dropped.
            inArray(lot.status, ["ended", "cancelled", "voided"]),
            dueBy("sale_start", lot.startTime, now),
            dueBy("day_before_close", lot.endTime, new Date(now.getTime() + 24 * hour)),
            dueBy("hour_before_close", lot.endTime, new Date(now.getTime() + hour)),
          ),
        ),
      )
      .orderBy(asc(lot.endTime))
      .limit(limit);
    return rows.map(({ status, kind, ...row }) => ({
      ...row,
      kind: kind as WatchedLotReminderKind,
      closed: CLOSED.has(status),
    }));
  }

  async markSent(watchlistId: string, at: Date): Promise<boolean> {
    const rows = await this.db
      .update(watchlistReminder)
      .set({ sentAt: at })
      .where(and(eq(watchlistReminder.watchlistId, watchlistId), isNull(watchlistReminder.sentAt)))
      .returning({ id: watchlistReminder.watchlistId });
    return rows.length > 0;
  }
}
