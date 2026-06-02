import { resolveAdminLegalEntityForPickerAction } from "@/lib/actions/admin-legal-entities-browse";
import { getWriteContainer } from "@/lib/data/write-container.server";
import type { VenueDetail } from "@/lib/services/interfaces/admin-venue-service";
import { notFound } from "next/navigation";
import { cache } from "react";

export const loadAdminVenueDetail = cache(async (venueId: string): Promise<VenueDetail> => {
  const result = await getWriteContainer().adminVenues.getDetail(venueId);
  if (!result.ok) {
    if (result.status === 404) notFound();
    throw new Error(result.message);
  }
  const { venue, salesUsingCount } = result.data;

  let legalEntityDisplayName: string | null = null;
  if (venue.legalEntityId) {
    const resolved = await resolveAdminLegalEntityForPickerAction(venue.legalEntityId).catch(
      () => null,
    );
    if (resolved?.ok && resolved.data) {
      legalEntityDisplayName = resolved.data.displayName;
    }
  }

  return { venue, salesUsingCount, legalEntityDisplayName };
});
