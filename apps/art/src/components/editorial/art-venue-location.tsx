import { ArtEditorialLink } from "@/components/editorial/art-editorial-link";
import type { VenuePageVm } from "@/lib/editorial/editorial-pages.composer";
import { telHref } from "@/lib/editorial/venue.vm";
import {
  MarketingClockIcon,
  MarketingFactColumns,
  MarketingMailIcon,
  MarketingMapPinIcon,
  MarketingPhoneIcon,
} from "@auction/marketing-ui";
import { Button } from "@auction/ui/components/button";

const LINK = "art-focus-ring break-words rounded-sm underline underline-offset-4";

/** Figma location detail `821:11603`: icon fact rows plus "View on Google Maps". */
export function ArtVenueLocation({
  facts: { venue, hours, addressLine, mapsHref },
}: {
  facts: Pick<VenuePageVm, "venue" | "hours" | "addressLine" | "mapsHref">;
}) {
  const facts = [
    {
      id: "location",
      label: "Location",
      icon: <MarketingMapPinIcon />,
      lines: addressLine
        ? [
            <ArtEditorialLink key="address" href={mapsHref} className={LINK}>
              {addressLine}
            </ArtEditorialLink>,
          ]
        : [],
    },
    {
      id: "hours",
      label: "Opening hours",
      icon: <MarketingClockIcon />,
      lines: hours.map((row) =>
        row.label === "Opening hours" ? row.value : `${row.label} ${row.value}`,
      ),
    },
    {
      id: "phone",
      label: "Gallery enquiries",
      icon: <MarketingPhoneIcon />,
      lines: venue.phone
        ? [
            <a key="phone" href={telHref(venue.phone)} className={LINK}>
              {venue.phone}
            </a>,
          ]
        : [],
    },
    {
      id: "email",
      label: "Email",
      icon: <MarketingMailIcon />,
      lines: venue.email
        ? [
            <ArtEditorialLink key="email" href={`mailto:${venue.email}`} className={LINK}>
              {venue.email}
            </ArtEditorialLink>,
          ]
        : [],
    },
  ];

  return (
    <div className="flex flex-col items-start gap-8">
      <MarketingFactColumns ariaLabel="Venue details" layout="list" facts={facts} />
      {mapsHref ? (
        <Button asChild variant="secondaryOutline" size="lg">
          <a href={mapsHref} target="_blank" rel="noreferrer noopener">
            View on Google Maps
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Button>
      ) : null}
    </div>
  );
}
