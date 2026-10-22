import { ArtEditorialLink } from "@/components/editorial/art-editorial-link";
import {
  CONTACT_LINK,
  contactLinkLines,
} from "@/components/exhibition/art-exhibition-contact-links";
import type { ExhibitionFactsVm } from "@/lib/editorial/exhibition-page.vm";
import {
  MarketingCalendarIcon,
  MarketingFactColumns,
  MarketingMapPinIcon,
  MarketingPhoneIcon,
} from "@auction/marketing-ui";

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
                  <ArtEditorialLink key="name" href={location.href} className={CONTACT_LINK}>
                    {location.name}
                  </ArtEditorialLink>
                ) : (
                  location.name
                ),
                ...(location.addressLine ? [location.addressLine] : []),
                ...(location.mapUrl
                  ? [
                      <ArtEditorialLink key="map" href={location.mapUrl} className={CONTACT_LINK}>
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
          // A named contact is introduced by the mobile specialist card instead.
          ...(contact?.name ? { className: "max-sm:hidden" } : {}),
          lines: contact
            ? [
                ...(contact.name ? [contact.name] : []),
                ...(contact.role ? [contact.role] : []),
                ...contactLinkLines(contact),
              ]
            : [],
        },
      ]}
    />
  );
}
