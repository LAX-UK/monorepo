import "server-only";

import { getAdminOnsiteEvents } from "@/lib/data/http/onsite-event.server";

export type EventRsvpsHubPageModel = {
  events: Awaited<ReturnType<typeof getAdminOnsiteEvents>>;
  totalRsvps: number;
  publishedCount: number;
  loadError: string | null;
};

/** Data/composition boundary for `/admin/event-rsvps` hub list. */
export async function loadAdminEventRsvpsHubPage(): Promise<EventRsvpsHubPageModel> {
  let events: Awaited<ReturnType<typeof getAdminOnsiteEvents>> = [];
  let loadError: string | null = null;

  try {
    events = await getAdminOnsiteEvents();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load event RSVPs.";
  }

  const totalRsvps = events.reduce((sum, event) => sum + event.rsvpCount, 0);
  const publishedCount = events.filter((event) => event.status === "published").length;

  return {
    events,
    totalRsvps,
    publishedCount,
    loadError,
  };
}
