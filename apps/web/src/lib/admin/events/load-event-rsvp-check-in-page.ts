import "server-only";

import { getAdminOnsiteEventDetail } from "@/lib/data/http/onsite-event.server";

export type EventRsvpCheckInPageModel = {
  slug: string;
  title: string;
  notFound: boolean;
};

type LoadEventRsvpCheckInPageInput = {
  slug: string;
};

/** Data/composition boundary for `/admin/event-rsvps/[slug]/check-in`. */
export async function loadAdminEventRsvpCheckInPage({
  slug,
}: LoadEventRsvpCheckInPageInput): Promise<EventRsvpCheckInPageModel> {
  const detail = await getAdminOnsiteEventDetail(slug).catch(() => null);
  if (!detail) {
    return { slug, title: slug, notFound: true };
  }
  return { slug, title: detail.title, notFound: false };
}
