"use client";

import { VenueMapCard } from "@/components/marketing/venue-map-card";
import type { Sale } from "@auction/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@auction/ui/components/sheet";
import {
  buildGoogleMapsEmbedUrl,
  formatPostalAddressLines,
  resolveOnsiteMapUrl,
} from "@auction/validators";
import type * as React from "react";

type Props = {
  sale: Sale;
  children: React.ReactNode;
};

export function OnsiteVenueDrawer({ sale, children }: Props) {
  const mapsUrl = resolveOnsiteMapUrl(sale);
  const embedUrl = buildGoogleMapsEmbedUrl(sale);
  const addressLines = formatPostalAddressLines(sale);

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="w-[min(480px,100vw)] p-6 z-50">
        <SheetHeader className="mb-4">
          <SheetTitle className="font-headline text-lg font-bold">Saleroom Location</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          <p className="font-body text-xs text-on-surface-variant leading-relaxed">
            Join us live at our gallery venue. Preview and register prior to session start.
          </p>
          <VenueMapCard
            locationName={sale.locationName}
            addressLines={addressLines}
            embedUrl={embedUrl}
            directionsUrl={mapsUrl}
            hasCustomMapUrl={Boolean(sale.locationMapUrl)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
