import { VenueMapCard } from "@/components/marketing/venue-map-card";
import { MapPin } from "lucide-react";
import type { SaleOverviewVM } from "./view-models";

type Props = {
  overview: SaleOverviewVM;
};

/** Physical venue + click-to-load map when `showLocation`. */
export function SaleroomOverviewVenue({ overview }: Props) {
  if (!overview.showLocation) return null;

  return (
    <div id="venue" className="mt-6">
      <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-on-surface">
        <MapPin className="size-5 shrink-0 text-primary" aria-hidden />
        Venue
      </h3>
      <VenueMapCard
        locationName={overview.locationName}
        addressLines={overview.locationAddressLines}
        locationAddress={overview.locationAddress}
        embedUrl={overview.locationEmbedUrl}
        directionsUrl={overview.resolvedMapUrl}
        hasCustomMapUrl={Boolean(overview.locationMapUrl)}
      />
    </div>
  );
}
