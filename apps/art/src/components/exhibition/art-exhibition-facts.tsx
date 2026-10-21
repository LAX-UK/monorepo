import { ArtEditorialLink } from "@/components/editorial/art-editorial-link";
import type { ExhibitionFactsVm } from "@/lib/editorial/exhibition-page.vm";
import {
  MarketingCalendarIcon,
  MarketingFactColumns,
  MarketingMapPinIcon,
  MarketingPhoneIcon,
} from "@auction/marketing-ui";

const LINK =
  "art-focus-ring rounded-sm text-on-surface underline underline-offset-4 hover:no-underline";

/** Location, viewing and contact columns under the page title (Figma `743:20964`). */
export function ArtExhibitionFacts({ facts }: { facts: ExhibitionFactsVm }) {
  const { location, viewing, contact } = facts;
  return (
    <MarketingFactColumns
      ariaLabel="Exhibition details"
      facts={[
        {
          id: "location",
          icon: <MarketingMapPinIcon />,
          label: "Location",
          lines: location
            ? [
                location.href ? (
                  <ArtEditorialLink key="name" href={location.href} className={LINK}>
                    {location.name}
                  </ArtEditorialLink>
                ) : (
                  location.name
                ),
                ...(location.addressLine ? [location.addressLine] : []),
                ...(location.mapUrl
                  ? [
                      <ArtEditorialLink key="map" href={location.mapUrl} className={LINK}>
                        Map<span className="sr-only"> to {location.name}</span>
                      </ArtEditorialLink>,
                    ]
                  : []),
              ]
            : [],
        },
        {
          id: "viewing",
          icon: <MarketingCalendarIcon />,
          label: "Viewing",
          lines: viewing,
        },
        {
          id: "contact",
          icon: <MarketingPhoneIcon />,
          label: "Contact",
          lines: contact
            ? [
                ...(contact.phone
                  ? [
                      <a
                        key="phone"
                        href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                        className={LINK}
                      >
                        {contact.phone}
                      </a>,
                    ]
                  : []),
                ...(contact.email
                  ? [
                      <ArtEditorialLink
                        key="email"
                        href={`mailto:${contact.email}`}
                        className={LINK}
                      >
                        {contact.email}
                      </ArtEditorialLink>,
                    ]
                  : []),
              ]
            : [],
        },
      ]}
    />
  );
}
