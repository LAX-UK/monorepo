import type {
  ArtEditorialExhibitionSummary,
  ArtEditorialVenueDetail,
  ArtEditorialVenueSummary,
} from "@/lib/editorial/art-editorial.types";
import { type EditorialCardVm, exhibitionCard } from "@/lib/editorial/editorial-card.vm";
import type { PageSectionTab } from "@/lib/editorial/editorial-page-title.vm";

type VenueAddress = Pick<ArtEditorialVenueSummary, "streetLine" | "postcode" | "city">;

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Figma's venue card: the street on one line, then city and postcode. Blank parts are dropped. */
export function venueCardAddressLines({ streetLine, postcode, city }: VenueAddress): string[] {
  const place = [clean(city), clean(postcode)].filter((part): part is string => part !== null);
  return [clean(streetLine), place.length > 0 ? place.join(" ") : null].filter(
    (line): line is string => line !== null,
  );
}

const GOOGLE_MAPS_SEARCH = "https://www.google.com/maps/search/?api=1&query=";

/**
 * Directions link for "View on Google Maps". Coordinates are exact, so they win over the
 * address; an editor-authored `mapUrl` is only used when neither is known.
 */
export function venueMapsHref(
  venue: Pick<
    ArtEditorialVenueDetail,
    "latitude" | "longitude" | "address" | "streetLine" | "postcode" | "city" | "mapUrl"
  >,
): string | null {
  if (typeof venue.latitude === "number" && typeof venue.longitude === "number") {
    return `${GOOGLE_MAPS_SEARCH}${venue.latitude},${venue.longitude}`;
  }
  const query = [venue.streetLine ?? venue.address, venue.city, venue.postcode]
    .map(clean)
    .filter((part): part is string => part !== null)
    .join(", ");
  if (query) return `${GOOGLE_MAPS_SEARCH}${encodeURIComponent(query)}`;
  return venue.mapUrl?.startsWith("https://") ? venue.mapUrl : null;
}

/** Cards for the shows at one venue, from a single exhibitions list read. */
export function exhibitionsAtVenue(
  items: readonly ArtEditorialExhibitionSummary[],
  venueSlug: string,
): EditorialCardVm[] {
  return items.filter((item) => item.venue?.slug === venueSlug).map(exhibitionCard);
}

/** "tel:" target without the spaces and punctuation people type into phone numbers. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** Jump-to tabs for the sections that render; none when fewer than two. */
export function venueSectionTabs(sections: {
  location: boolean;
  exhibitions: boolean;
}): PageSectionTab[] {
  const tabs = [
    sections.location ? { id: "location", label: "Location" } : null,
    sections.exhibitions ? { id: "exhibitions", label: "Current exhibitions" } : null,
  ].filter((tab): tab is PageSectionTab => tab !== null);
  return tabs.length > 1 ? tabs : [];
}
