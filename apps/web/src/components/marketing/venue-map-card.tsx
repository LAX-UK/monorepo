"use client";

import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ExternalLink, MapPin } from "lucide-react";
import { useCallback, useId, useState } from "react";

type Props = {
  locationName?: string | null;
  addressLines: readonly string[];
  /** Fallback free-form address when structured lines are empty. */
  locationAddress?: string | null;
  embedUrl?: string | null;
  directionsUrl?: string | null;
  /** When true, the directions link label reads "Open map" (admin override). */
  hasCustomMapUrl?: boolean;
  className?: string;
  id?: string;
};

/** Click-to-load venue map preview with address and directions link. */
export function VenueMapCard({
  locationName,
  addressLines,
  locationAddress,
  embedUrl,
  directionsUrl,
  hasCustomMapUrl = false,
  className,
  id,
}: Props) {
  const generatedMapRegionId = useId();
  const mapRegionId = id ? `${id}-map-region` : generatedMapRegionId;
  const [mapVisible, setMapVisible] = useState(false);

  const showMap = useCallback(() => {
    setMapVisible(true);
  }, []);

  const hasAddress = addressLines.length > 0 || Boolean(locationAddress?.trim());
  const hasContent = Boolean(locationName?.trim() || hasAddress || embedUrl || directionsUrl);

  if (!hasContent) return null;

  return (
    <div id={id} className={cn("space-y-4", className)}>
      {locationName ? (
        <p className="font-body text-base font-medium text-on-surface">{locationName}</p>
      ) : null}
      {addressLines.length > 0 ? (
        <address className="font-body text-sm not-italic leading-relaxed text-on-surface-variant">
          {addressLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
      ) : locationAddress ? (
        <p className="whitespace-pre-line font-body text-sm leading-relaxed text-on-surface-variant">
          {locationAddress}
        </p>
      ) : null}

      {embedUrl && !mapVisible ? (
        <Button
          type="button"
          variant="ghost"
          onClick={showMap}
          className="relative flex w-full flex-col items-center justify-center overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-high/60 px-4 py-10 text-center transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-expanded={false}
          aria-controls={mapRegionId}
        >
          <MapPin className="size-8 text-primary" aria-hidden />
          <span className="mt-3 font-body text-sm font-medium text-on-surface">Show map</span>
          <span className="mt-1 max-w-xs font-body text-xs text-on-surface-variant">
            Loads Google Maps when you choose to preview the venue
          </span>
        </Button>
      ) : null}

      {embedUrl && mapVisible ? (
        <div
          id={mapRegionId}
          className="overflow-hidden rounded-xl border border-outline-variant/30"
        >
          <iframe
            title={locationName ? `Map of ${locationName}` : "Venue map"}
            src={embedUrl}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="aspect-[16/10] w-full border-0 bg-surface-container-high"
            allowFullScreen
          />
        </div>
      ) : null}

      {directionsUrl ? (
        <Button variant="outline" asChild className="gap-2">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={hasCustomMapUrl ? "Open map in new tab" : "Get directions in Google Maps"}
          >
            <ExternalLink className="size-4 shrink-0" aria-hidden />
            {hasCustomMapUrl ? "Open map" : "Get directions"}
          </a>
        </Button>
      ) : null}
    </div>
  );
}
