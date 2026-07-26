import "server-only";

import { getAdminExpectedGuests } from "@/lib/data/http/admin-expected-guests.server";
import {
  getAdminOnsiteEventDetail,
  getAdminOnsiteEventRsvps,
} from "@/lib/data/http/onsite-event.server";

type OnsiteEventDetail = NonNullable<Awaited<ReturnType<typeof getAdminOnsiteEventDetail>>>;

export type EventRsvpDetailPageModel = {
  slug: string;
  detail: OnsiteEventDetail | null;
  rsvps: Awaited<ReturnType<typeof getAdminOnsiteEventRsvps>>;
  venueDayCounts: {
    rsvped: number;
    galaCheckedIn: number;
    salePresent: number;
    paddled: number;
  } | null;
  loadError: string | null;
  notFound: boolean;
};

type LoadEventRsvpDetailPageInput = {
  slug: string;
};

/** Data/composition boundary for `/admin/event-rsvps/[slug]`. */
export async function loadAdminEventRsvpDetailPage({
  slug,
}: LoadEventRsvpDetailPageInput): Promise<EventRsvpDetailPageModel> {
  let loadError: string | null = null;

  try {
    const detail = await getAdminOnsiteEventDetail(slug);
    if (!detail) {
      return {
        slug,
        detail: null,
        rsvps: [],
        venueDayCounts: null,
        loadError: null,
        notFound: true,
      };
    }

    let rsvps: Awaited<ReturnType<typeof getAdminOnsiteEventRsvps>> = [];
    try {
      rsvps = await getAdminOnsiteEventRsvps(slug);
    } catch (e) {
      loadError = e instanceof Error ? e.message : "Could not load RSVPs.";
    }

    let venueDayCounts: EventRsvpDetailPageModel["venueDayCounts"] = null;
    if (detail.saleId) {
      try {
        const linked = await getAdminExpectedGuests(detail.saleId);
        venueDayCounts = linked.counts;
      } catch {
        // Non-fatal — RSVP list still renders.
      }
    }

    return {
      slug,
      detail,
      rsvps,
      venueDayCounts,
      loadError,
      notFound: false,
    };
  } catch (e) {
    return {
      slug,
      detail: null,
      rsvps: [],
      venueDayCounts: null,
      loadError: e instanceof Error ? e.message : "Could not load onsite event data.",
      notFound: false,
    };
  }
}
