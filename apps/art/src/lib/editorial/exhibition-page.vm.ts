import { artistLifeLine } from "@/lib/catalogue/artist-life-line";
import { artistHref } from "@/lib/catalogue/catalogue-artwork-card.vm";
import type {
  ArtEditorialExhibitionSummary,
  ArtEditorialStorySummary,
} from "@/lib/editorial/art-editorial.types";
import { formatExhibitionDates, venueKickerLabel } from "@/lib/editorial/editorial-card.vm";
import type { OpeningHoursRow } from "@/lib/editorial/editorial-pages.composer";
import type { PublicArtistDetail } from "@auction/shop-contracts";

/** The exhibition's named gallery contact, as the API returns it. */
export type ExhibitionContactInput = {
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
};

export type ExhibitionFactsInput = {
  dateLabel: string | null;
  contact?: ExhibitionContactInput | null | undefined;
  timesNote: string | null;
  hours: readonly OpeningHoursRow[];
  venue: {
    name: string;
    href: string | null;
    addressLine: string | null;
    mapUrl: string | null;
    phone: string | null;
    email: string | null;
  } | null;
};

export type ExhibitionFactsVm = {
  location: {
    name: string;
    href: string | null;
    addressLine: string | null;
    mapUrl: string | null;
  } | null;
  /** Dates, then the times note or one line per opening-hours row. */
  viewing: string[];
  /** `name` is set when a named specialist is shown; otherwise the venue's phone and email. */
  contact: {
    name: string | null;
    role: string | null;
    phone: string | null;
    email: string | null;
    avatarUrl: string | null;
  } | null;
};

function trimmed(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

/**
 * Location, viewing and contact for the facts row (Figma `743:20964`). The exhibition's named
 * contact leads; the venue's phone and email stand in when none is set.
 */
export function buildExhibitionFacts({
  dateLabel,
  contact,
  timesNote,
  hours,
  venue,
}: ExhibitionFactsInput): ExhibitionFactsVm {
  const note = timesNote?.trim();
  const hoursLines = note
    ? [note]
    : hours.map((row) => (row.label === "Opening hours" ? row.value : `${row.label} ${row.value}`));
  const specialistName = trimmed(contact?.name);
  const phone = trimmed(specialistName ? contact?.phone : venue?.phone);
  const email = trimmed(specialistName ? contact?.email : venue?.email);
  return {
    location: venue
      ? {
          name: venue.name,
          href: venue.href,
          addressLine: venue.addressLine,
          mapUrl: venue.mapUrl?.trim() || null,
        }
      : null,
    viewing: [dateLabel, ...hoursLines].filter((line): line is string => Boolean(line)),
    contact:
      specialistName || phone || email
        ? {
            name: specialistName,
            role: specialistName ? trimmed(contact?.role) : null,
            phone,
            email,
            avatarUrl: specialistName ? trimmed(contact?.avatarUrl) : null,
          }
        : null,
  };
}

export type ExhibitionArtistVm = {
  slug: string;
  name: string;
  href: string;
  portraitUrl: string | null;
  lifeLine: string | null;
  bio: string | null;
};

export function buildExhibitionArtists(
  artists: readonly PublicArtistDetail[],
): ExhibitionArtistVm[] {
  return artists.map((artist) => ({
    slug: artist.slug,
    name: artist.name,
    href: artistHref(artist.slug),
    portraitUrl: artist.portraitUrl,
    lifeLine: artistLifeLine(artist),
    bio: artist.bio?.trim() || artist.shortBio?.trim() || null,
  }));
}

export type ExhibitionPressVm = {
  key: string;
  href: string;
  title: string;
  dateLabel: string | null;
};

const LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function longDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : LONG_DATE.format(date);
}

/** Stories of kind `press`, in the order the API returns them. */
export function buildExhibitionPress(
  stories: readonly ArtEditorialStorySummary[],
): ExhibitionPressVm[] {
  return stories
    .filter((story) => story.kind === "press")
    .map((story) => ({
      key: story.slug,
      href: `/stories/${encodeURIComponent(story.slug)}`,
      title: story.title,
      dateLabel: longDate(story.publishedAt),
    }));
}

export type ExhibitionRevealVm = {
  key: string;
  /** "Featured exhibition", then the venue when the summary carries one. */
  eyebrow: string[];
  meta: string[];
  title: string;
  summary: string | null;
  href: string;
  imageUrl: string | null;
};

export function buildExhibitionReveals(
  items: readonly ArtEditorialExhibitionSummary[],
): ExhibitionRevealVm[] {
  return items.map((item) => {
    const dates = formatExhibitionDates(item.startsOn, item.endsOn);
    return {
      key: item.slug,
      eyebrow: ["Featured exhibition", venueKickerLabel(item.venue)].filter(
        (part): part is string => Boolean(part),
      ),
      meta: dates ? [dates] : [],
      title: item.title,
      summary: item.summary?.trim() || null,
      href: `/exhibitions/${encodeURIComponent(item.slug)}`,
      imageUrl: item.coverUrl,
    };
  });
}
