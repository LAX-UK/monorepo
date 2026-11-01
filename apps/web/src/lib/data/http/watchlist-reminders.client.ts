import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import type { WatchedLotReminderKind } from "@auction/domain";

export type WatchlistReminderInput = { kind: WatchedLotReminderKind; note: string };

/** Sets or removes the reminder on a watched lot; the port the dialog depends on. */
export type WatchlistReminderClient = {
  set(lotId: string, input: WatchlistReminderInput): Promise<boolean>;
  clear(lotId: string): Promise<boolean>;
};

function path(lotId: string) {
  return `${browserApiBase()}/users/me/watchlist/${encodeURIComponent(lotId)}/reminder`;
}

export const defaultWatchlistReminderClient: WatchlistReminderClient = {
  async set(lotId, input) {
    const res = await browserFetch(path(lotId), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    return res.ok;
  },
  async clear(lotId) {
    const res = await browserFetch(path(lotId), { method: "DELETE" });
    return res.ok;
  },
};
