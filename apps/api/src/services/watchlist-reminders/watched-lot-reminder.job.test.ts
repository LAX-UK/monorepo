import type { PendingWatchlistReminder } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { WatchedLotReminderJob } from "./watched-lot-reminder.job.js";

const now = new Date("2026-11-26T17:00:00Z");
const HOUR = 60 * 60 * 1000;

const reminder = (fields: Partial<PendingWatchlistReminder>): PendingWatchlistReminder => ({
  watchlistId: "w1",
  userId: "u1",
  lotId: "lot-1",
  kind: "hour_before_close",
  note: "Check the frame",
  lotTitle: "Red chair, evening",
  startTime: new Date(now.getTime() - 24 * HOUR),
  endTime: new Date(now.getTime() + HOUR),
  closed: false,
  ...fields,
});

function setup(pending: PendingWatchlistReminder[], alreadyClaimed: string[] = []) {
  const claimed = new Set(alreadyClaimed);
  const markSent = vi.fn(async (id: string) => {
    if (claimed.has(id)) return false;
    claimed.add(id);
    return true;
  });
  const dispatch = vi.fn(async (_userId: string, _payload: unknown) => undefined);
  const job = new WatchedLotReminderJob({
    reminders: { listPending: vi.fn(async () => pending), markSent },
    dispatcher: { dispatch },
  });
  return { job, dispatch, markSent };
}

describe("WatchedLotReminderJob", () => {
  it("sends a due reminder once through the dispatcher, with the note", async () => {
    const { job, dispatch } = setup([reminder({})]);
    expect(await job.sendDue(now)).toEqual({ sent: 1, dropped: 0 });
    expect(dispatch).toHaveBeenCalledWith("u1", {
      type: "watchlist_ending_soon",
      title: 'Reminder: "Red chair, evening"',
      message: "It closes in about an hour. Your note: Check the frame",
      lotId: "lot-1",
      legalEntityId: null,
      meta: {
        lotTitle: "Red chair, evening",
        outboxIdempotencyKey: "watched-lot-reminder:w1:hour_before_close",
      },
    });
  });

  it("sends a sale-start reminder as the watchlist start notice", async () => {
    const { job, dispatch } = setup([
      reminder({ kind: "sale_start", startTime: new Date(now.getTime() - 10 * 60 * 1000) }),
    ]);
    await job.sendDue(now);
    expect(dispatch.mock.calls[0]?.[1]).toMatchObject({ type: "watchlist_starting" });
  });

  it("drops a reminder whose lot closed, and leaves one not yet due", async () => {
    const { job, dispatch, markSent } = setup([
      reminder({ watchlistId: "closed", closed: true }),
      reminder({ watchlistId: "later", endTime: new Date(now.getTime() + 3 * HOUR) }),
    ]);
    expect(await job.sendDue(now)).toEqual({ sent: 0, dropped: 1 });
    expect(dispatch).not.toHaveBeenCalled();
    expect(markSent).toHaveBeenCalledTimes(1);
  });

  it("skips a reminder another run already claimed", async () => {
    const { job, dispatch } = setup([reminder({})], ["w1"]);
    expect(await job.sendDue(now)).toEqual({ sent: 0, dropped: 0 });
    expect(dispatch).not.toHaveBeenCalled();
  });
});
