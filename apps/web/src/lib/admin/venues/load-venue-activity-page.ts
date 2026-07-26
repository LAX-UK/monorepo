import "server-only";

import { loadAdminVenueDetail } from "@/lib/admin/load-venue-detail";
import { getAdminDomainEventsForAggregate } from "@/lib/data/http/admin.server";

export type VenueActivityPageModel = {
  venueId: string;
  events: Awaited<ReturnType<typeof getAdminDomainEventsForAggregate>>;
};

/** Data/composition boundary for `/admin/venues/[id]/activity`. */
export async function loadAdminVenueActivityPage(venueId: string): Promise<VenueActivityPageModel> {
  await loadAdminVenueDetail(venueId);
  const events = await getAdminDomainEventsForAggregate({
    aggregateType: "venue",
    aggregateId: venueId,
    limit: 100,
  }).catch(() => []);

  return { venueId, events };
}
