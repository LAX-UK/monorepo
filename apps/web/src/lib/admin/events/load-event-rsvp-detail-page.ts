import "server-only";

import { getAdminExpectedGuests } from "@/lib/data/http/admin-expected-guests.server";
import { getAdminSaleById } from "@/lib/data/http/admin-sale-registrations.reader";
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
  /** The linked sale's name, so the page shows it instead of its id. */
  linkedSaleTitle: string | null;
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
        linkedSaleTitle: null,
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
    let linkedSaleTitle: string | null = null;
    if (detail.saleId) {
      const saleId = detail.saleId;
      const [guests, sale] = await Promise.allSettled([
        getAdminExpectedGuests(saleId),
        getAdminSaleById(saleId),
      ]);
      // Non-fatal: the RSVP list still renders without the venue-day counts or the sale's name.
      if (guests.status === "fulfilled") venueDayCounts = guests.value.counts;
      if (sale.status === "fulfilled") linkedSaleTitle = sale.value?.sale.title ?? null;
    }

    return {
      slug,
      detail,
      rsvps,
      venueDayCounts,
      linkedSaleTitle,
      loadError,
      notFound: false,
    };
  } catch (e) {
    return {
      slug,
      detail: null,
      rsvps: [],
      venueDayCounts: null,
      linkedSaleTitle: null,
      loadError: e instanceof Error ? e.message : "Could not load onsite event data.",
      notFound: false,
    };
  }
}
