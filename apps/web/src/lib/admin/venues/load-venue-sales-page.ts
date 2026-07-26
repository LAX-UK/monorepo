import "server-only";

import { loadAdminVenueDetail } from "@/lib/admin/load-venue-detail";

export type VenueSalesPageModel = {
  venueId: string;
  salesUsingCount: number;
};

/** Data/composition boundary for `/admin/venues/[id]/sales`. */
export async function loadAdminVenueSalesPage(venueId: string): Promise<VenueSalesPageModel> {
  const { salesUsingCount } = await loadAdminVenueDetail(venueId);

  return { venueId, salesUsingCount };
}
