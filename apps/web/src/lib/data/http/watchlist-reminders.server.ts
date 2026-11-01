import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { WATCHED_LOT_REMINDER_KINDS, type WatchedLotReminderKind } from "@auction/domain";
import { z } from "zod";

/** A watched lot's reminder as the API sends it. */
export type WatchlistReminderView = {
  lotId: string;
  kind: WatchedLotReminderKind;
  note: string | null;
  sentAt: string | null;
};

const reminderSchema = z.object({
  lotId: z.string(),
  kind: z.enum(WATCHED_LOT_REMINDER_KINDS),
  note: z.string().nullable(),
  sentAt: z.string().nullable(),
}) satisfies z.ZodType<WatchlistReminderView>;

/** The person's reminders on watched lots; `null` when they could not be read. */
export async function getServerWatchlistReminders(): Promise<WatchlistReminderView[] | null> {
  const res = await authedServerFetch("/users/me/watchlist/reminders", { cache: "no-store" });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
  const parsed = z.array(reminderSchema).safeParse(body?.data);
  return parsed.success ? parsed.data : null;
}
