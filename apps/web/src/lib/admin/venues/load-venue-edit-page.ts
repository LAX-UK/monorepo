import "server-only";

import { loadAdminVenueDetail } from "@/lib/admin/load-venue-detail";
import type { VenueDetail } from "@/lib/services/interfaces/admin-venue-service";

export type VenueEditPageModel = VenueDetail & {
  venueId: string;
  detailHref: string;
};

/** Data/composition boundary for `/admin/venues/[id]/edit`. */
export async function loadAdminVenueEditPage(venueId: string): Promise<VenueEditPageModel> {
  const detail = await loadAdminVenueDetail(venueId);
  return {
    ...detail,
    venueId,
    detailHref: `/admin/venues/${venueId}`,
  };
}
