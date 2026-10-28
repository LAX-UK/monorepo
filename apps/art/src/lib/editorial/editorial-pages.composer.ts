import type { ArtViewerState } from "@/lib/art-viewer-state";
import {
  type CatalogueArtworkCardVm,
  buildCatalogueArtworkCards,
} from "@/lib/catalogue/catalogue-artwork-card.vm";
import type {
  ArtEditorialExhibitionDetail,
  ArtEditorialExhibitionSummary,
  ArtEditorialFetchResult,
  ArtEditorialPreview,
  ArtEditorialStoryDetail,
  ArtEditorialStorySummary,
  ArtEditorialVenueDetail,
  ArtExhibitionStatus,
} from "@/lib/editorial/art-editorial.types";
import {
  type EditorialBodyVm,
  composeEditorialBody,
} from "@/lib/editorial/editorial-body.composer";
import {
  type EditorialCardVm,
  exhibitionCard,
  exhibitionKindLabel,
  formatExhibitionDates,
} from "@/lib/editorial/editorial-card.vm";
import { editorialPageHref } from "@/lib/editorial/editorial-page-routes";
import {
  type PageSectionTab,
  exhibitionHasEnded,
  exhibitionMetaLine,
} from "@/lib/editorial/editorial-page-title.vm";
import {
  type RelatedContentVm,
  currentOrUpcomingExhibitions,
  newestFirst,
  selectRelatedContent,
  storyByline,
  storyCategory,
  storyCategoryLabel,
} from "@/lib/editorial/editorial-story.vm";
import {
  type ExhibitionArtistVm,
  type ExhibitionFactsVm,
  type ExhibitionPressVm,
  type ExhibitionRevealVm,
  buildExhibitionArtists,
  buildExhibitionFacts,
  buildExhibitionPress,
  buildExhibitionReveals,
} from "@/lib/editorial/exhibition-page.vm";
import { type HubFeatureCardVm, guideCard, hubFeatureCards } from "@/lib/editorial/hub-card.vm";
import {
  exhibitionsAtVenue,
  venueCardAddressLines,
  venueMapsHref,
  venueSectionTabs,
} from "@/lib/editorial/venue.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { loadViewerFavoriteContext } from "@/lib/favorites/viewer-favorites";
import type {
  ArtCataloguePort,
  ArtEditorialPort,
  ArtFavoritesReadPort,
  ArtViewerPort,
} from "@/lib/ports";
import { seoMetadataDescription, seoMetadataTitle } from "@/lib/seo/seo-metadata";
import type { EditorialBlock } from "@auction/shop-contracts";

type BodyServices = {
  catalogue: Pick<ArtCataloguePort, "getArtwork" | "getArtist">;
  viewer: ArtViewerPort;
  favorites: ArtFavoritesReadPort;
};

type Services<K extends keyof ArtEditorialPort> = BodyServices & {
  editorial: Pick<ArtEditorialPort, K>;
};

/** Non-ok fetch results pass through unchanged so pages share one status renderer. */
export type ArtEditorialPageResult<T> =
  | Exclude<ArtEditorialFetchResult<never>, { status: "ok" }>
  | { status: "ok"; data: T };

function passThrough<T>(
  result: Exclude<ArtEditorialFetchResult<unknown>, { status: "ok" }>,
): ArtEditorialPageResult<T> {
  return result;
}

export type OpeningHoursRow = { label: string; value: string };

/** Accepts `{ "Tue – Sat": "10:00 – 18:00" }`, `[{ label, hours }]` or a plain string. */
export function presentOpeningHours(value: unknown): OpeningHoursRow[] {
  if (typeof value === "string") {
    return value.trim() ? [{ label: "Opening hours", value: value.trim() }] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((row) => {
      if (!row || typeof row !== "object") return [];
      const { label, hours, value: rowValue } = row as Record<string, unknown>;
      const text = typeof hours === "string" ? hours : rowValue;
      return typeof label === "string" && typeof text === "string" && label.trim() && text.trim()
        ? [{ label: label.trim(), value: text.trim() }]
        : [];
    });
  }
  if (value && typeof value === "object") {
    // jsonb does not keep object key order, so map-form hours are re-ordered by weekday.
    return Object.entries(value as Record<string, unknown>)
      .flatMap(([label, text]) =>
        typeof text === "string" && label.trim() && text.trim()
          ? [{ label: label.trim(), value: text.trim() }]
          : [],
      )
      .sort((a, b) => weekdayRank(a.label) - weekdayRank(b.label));
  }
  return [];
}

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function weekdayRank(label: string): number {
  const match = /\b(mon|tue|wed|thu|fri|sat|sun)/i.exec(label);
  return match?.[1] ? WEEKDAYS.indexOf(match[1].toLowerCase() as (typeof WEEKDAYS)[number]) : 7;
}

export const EXHIBITION_STATUS_TABS: readonly { value: ArtExhibitionStatus; label: string }[] = [
  { value: "current", label: "Current" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
];

export function parseExhibitionStatus(value: string | string[] | undefined): ArtExhibitionStatus {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "upcoming" || raw === "past" ? raw : "current";
}

const FEATURED_EXHIBITION_STATUSES: readonly ArtExhibitionStatus[] = ["current", "upcoming"];
const FEATURED_EXHIBITIONS_LIMIT = 6;

export type ExhibitionsPageVm = {
  status: ArtExhibitionStatus;
  cards: EditorialCardVm[];
  /** Featured current and upcoming shows for the hero, whichever tab is active. */
  featured: ExhibitionRevealVm[];
};

export async function composeExhibitionsPage(
  services: Pick<Services<"listExhibitions">, "editorial">,
  status: ArtExhibitionStatus,
): Promise<ArtEditorialPageResult<ExhibitionsPageVm>> {
  const statuses = [status, ...FEATURED_EXHIBITION_STATUSES.filter((s) => s !== status)];
  const [result, ...others] = await Promise.all(
    statuses.map((s) => services.editorial.listExhibitions(s)),
  );
  if (!result || result.status !== "ok") {
    return passThrough(result ?? { status: "error" });
  }
  const byStatus = new Map(statuses.map((s, i) => [s, i === 0 ? result : others[i - 1]]));
  const featuredBySlug = new Map<string, ArtEditorialExhibitionSummary>();
  for (const s of FEATURED_EXHIBITION_STATUSES) {
    const list = byStatus.get(s);
    if (list?.status !== "ok") continue;
    for (const item of list.data.items) {
      if (item.featured && !featuredBySlug.has(item.slug)) featuredBySlug.set(item.slug, item);
    }
  }
  const items = result.data.items;
  const featured = heroRepeatsGrid(items, featuredBySlug)
    ? []
    : buildExhibitionReveals([...featuredBySlug.values()].slice(0, FEATURED_EXHIBITIONS_LIMIT));
  return {
    status: "ok",
    data: { status, cards: items.map(exhibitionCard), featured },
  };
}

/** The hero adds nothing when every show in the grid is already one of its slides. */
function heroRepeatsGrid(
  items: readonly ArtEditorialExhibitionSummary[],
  featuredBySlug: ReadonlyMap<string, ArtEditorialExhibitionSummary>,
): boolean {
  return items.length > 0 && items.every((item) => featuredBySlug.has(item.slug));
}

export type ExhibitionDetailVm = {
  exhibition: ArtEditorialExhibitionDetail;
  /** Page title byline, e.g. "Exhibition · 18 Aug – 27 Aug 2026". */
  metaLine: string;
  /** Past its end date: the title shows "Closed" and the CTA band is plain (Figma 737:20593). */
  ended: boolean;
  dateLabel: string | null;
  facts: ExhibitionFactsVm;
  body: EditorialBodyVm;
  works: CatalogueArtworkCardVm[];
  artists: ExhibitionArtistVm[];
  press: ExhibitionPressVm[];
  viewer: ArtViewerState;
  favoriteAuth: ArtFavoriteAuth;
};

export async function composeExhibitionDetailPage(
  services: Services<"getExhibition" | "getVenue">,
  slug: string,
  now: Date = new Date(),
): Promise<ArtEditorialPageResult<ExhibitionDetailVm>> {
  const result = await services.editorial.getExhibition(slug);
  if (result.status !== "ok") return passThrough(result);
  const exhibition = result.data;
  const returnTo = `/exhibitions/${encodeURIComponent(exhibition.slug)}`;
  const [venueResult, body, favorites] = await Promise.all([
    exhibition.venueSlug ? services.editorial.getVenue(exhibition.venueSlug) : null,
    composeEditorialBody(exhibition.body, services, returnTo),
    loadViewerFavoriteContext(services, returnTo),
  ]);
  const dateLabel = formatExhibitionDates(exhibition.startsOn, exhibition.endsOn);
  const venueDetail = venueResult?.status === "ok" ? venueResult.data : null;
  // The detail's own venue summary still names the venue when the full venue read fails.
  const venue = venueDetail
    ? {
        name: venueDetail.name,
        href: venueHref(venueDetail.slug),
        addressLine: venueAddressParts(venueDetail).join(", ") || null,
        mapUrl: venueDetail.mapUrl,
        phone: venueDetail.phone,
        email: venueDetail.email,
      }
    : exhibition.venue
      ? {
          name: exhibition.venue.name,
          href: venueHref(exhibition.venue.slug),
          addressLine: null,
          mapUrl: null,
          phone: null,
          email: null,
        }
      : null;
  return {
    status: "ok",
    data: {
      exhibition,
      metaLine: exhibitionMetaLine(
        exhibition.subtitle?.trim() || exhibitionKindLabel(exhibition.kind),
        dateLabel,
      ),
      ended: exhibitionHasEnded(exhibition.endsOn, now),
      dateLabel,
      facts: buildExhibitionFacts({
        dateLabel,
        contact: exhibition.contact,
        timesNote: exhibition.timesNote,
        hours: venueDetail ? presentOpeningHours(venueDetail.openingHours) : [],
        venue,
      }),
      body,
      works: buildCatalogueArtworkCards(exhibition.artworks ?? [], favorites.savedArtworkSlugs),
      artists: buildExhibitionArtists(exhibition.artists ?? []),
      press: buildExhibitionPress(exhibition.stories ?? []),
      viewer: favorites.viewer,
      favoriteAuth: favorites.favoriteAuth,
    },
  };
}

export type StoryPageVm = {
  story: ArtEditorialStoryDetail;
  /** Category label shown above the title, e.g. "Artist interview". */
  kicker: string;
  /** “By <author> · <date>” (Figma `687:17324`). */
  byline: string | null;
  body: EditorialBodyVm;
  related: RelatedContentVm | null;
};

export async function composeStoryPage(
  services: Services<"getStory" | "listStories">,
  slug: string,
  now: Date = new Date(),
): Promise<ArtEditorialPageResult<StoryPageVm>> {
  const result = await services.editorial.getStory(slug);
  if (result.status !== "ok") return passThrough(result);
  const story = result.data;
  const exhibitions = story.related?.exhibitions ?? [];
  const [body, storyGroups] = await Promise.all([
    composeEditorialBody(story.body, services, `/stories/${encodeURIComponent(story.slug)}`),
    // Related stories are only fetched when no exhibition takes the slot.
    currentOrUpcomingExhibitions(exhibitions, now).length > 0
      ? []
      : loadSameSeriesAndCategory(services.editorial, story),
  ]);
  return {
    status: "ok",
    data: {
      story,
      kicker: storyCategoryLabel(story),
      byline: storyByline(story),
      body,
      related: selectRelatedContent({ exhibitions, storyGroups, currentSlug: story.slug, now }),
    },
  };
}

/** Same series first, then same category; a failed read just means that group is empty. */
async function loadSameSeriesAndCategory(
  editorial: Pick<ArtEditorialPort, "listStories">,
  story: ArtEditorialStoryDetail,
): Promise<ArtEditorialStorySummary[][]> {
  const filters = [
    ...(story.series ? [{ series: story.series }] : []),
    { category: storyCategory(story) },
  ];
  const results = await Promise.all(filters.map((filter) => editorial.listStories(filter)));
  return results.map((r) => (r.status === "ok" ? newestFirst(r.data.items) : []));
}

export type EditorialPageVm = {
  slug: string;
  title: string;
  canonicalPath: string;
  metaTitle: string;
  metaDescription?: string;
  body: EditorialBodyVm;
};

const MIN_EXCERPT_LENGTH = 40;

/** First substantial paragraph, used when no SEO description is set. */
function firstParagraphText(blocks: readonly EditorialBlock[]): string | null {
  for (const block of blocks) {
    if (block.type !== "richText") continue;
    const text = block.spans
      .map((span) => span.text)
      .join("")
      .trim();
    if (text.length >= MIN_EXCERPT_LENGTH) return text;
  }
  return null;
}

/** Any `editorial_page` (guide, legal, Collector Hub service page) at its canonical route. */
export async function composeEditorialPage(
  services: Services<"getPage">,
  slug: string,
): Promise<ArtEditorialPageResult<EditorialPageVm>> {
  const result = await services.editorial.getPage(slug);
  if (result.status !== "ok") return passThrough(result);
  const canonicalPath = editorialPageHref(result.data.slug);
  const body = await composeEditorialBody(result.data.body, services, canonicalPath);
  const metaDescription = seoMetadataDescription(result.data, firstParagraphText(result.data.body));
  return {
    status: "ok",
    data: {
      slug: result.data.slug,
      title: result.data.title,
      canonicalPath,
      metaTitle: seoMetadataTitle(result.data, result.data.title),
      ...(metaDescription ? { metaDescription } : {}),
      body,
    },
  };
}

export type VenueFactsVm = {
  venue: ArtEditorialVenueDetail;
  hours: OpeningHoursRow[];
  addressLine: string | null;
};

/** A listed venue as the `/visit` index card shows it. */
export type VenueIndexCardVm = {
  slug: string;
  name: string;
  href: string;
  imageUrl: string | null;
  addressLines: string[];
};

export type VisitPageVm = {
  /** The CMS "visit" page title when one is published. */
  title: string;
  /** First paragraph of the CMS "visit" page; null without one. */
  intro: string | null;
  venues: VenueIndexCardVm[];
};

export type VenuePageVm = VenueFactsVm & {
  body: EditorialBodyVm;
  /** Google Maps directions; null when the venue has no coordinates, address or map link. */
  mapsHref: string | null;
  /** Whether any location fact (address, hours, phone, email, directions) can be shown. */
  hasLocation: boolean;
  /** Current exhibitions held at this venue. */
  exhibitions: EditorialCardVm[];
  /** Jump-to tabs for the sections that render. */
  sectionTabs: PageSectionTab[];
};

export function venueHref(slug: string): string {
  return `/visit/${encodeURIComponent(slug)}`;
}

/** Street, then postcode; blank parts are dropped. */
export function venueAddressParts(venue: Pick<ArtEditorialVenueDetail, "address" | "postcode">) {
  return [venue.address, venue.postcode].flatMap((part) => (part?.trim() ? [part.trim()] : []));
}

function venueFacts(venue: ArtEditorialVenueDetail): VenueFactsVm {
  const addressLine = venueAddressParts(venue).join(", ");
  return {
    venue,
    hours: presentOpeningHours(venue.openingHours),
    addressLine: addressLine || null,
  };
}

const VISIT_VENUES_LIMIT = 6;
const VISIT_PAGE_SLUG = "visit";
const VISIT_DEFAULT_TITLE = "Visit the gallery";

/**
 * Published venues straight from the list (it carries the card address, so there are no
 * per-venue reads). An optional CMS page with slug "visit" supplies the title and intro.
 */
export async function composeVisitPage(
  services: Pick<Services<"listVenues" | "getPage">, "editorial">,
): Promise<ArtEditorialPageResult<VisitPageVm>> {
  const [list, page] = await Promise.all([
    services.editorial.listVenues(),
    services.editorial.getPage(VISIT_PAGE_SLUG),
  ]);
  if (list.status !== "ok") return passThrough(list);
  const venues = list.data.items.slice(0, VISIT_VENUES_LIMIT).map((item) => ({
    slug: item.slug,
    name: item.name,
    href: venueHref(item.slug),
    imageUrl: item.coverUrl,
    addressLines: venueCardAddressLines(item),
  }));
  return {
    status: "ok",
    data: {
      title: page.status === "ok" ? page.data.title : VISIT_DEFAULT_TITLE,
      intro: page.status === "ok" ? firstParagraphText(page.data.body) : null,
      venues,
    },
  };
}

export async function composeVenuePage(
  services: Services<"getVenue" | "listExhibitions">,
  slug: string,
): Promise<ArtEditorialPageResult<VenuePageVm>> {
  const [result, current] = await Promise.all([
    services.editorial.getVenue(slug),
    services.editorial.listExhibitions("current"),
  ]);
  if (result.status !== "ok") return passThrough(result);
  const facts = venueFacts(result.data);
  const body = await composeEditorialBody(result.data.body, services, venueHref(result.data.slug));
  const mapsHref = venueMapsHref(result.data);
  const exhibitions =
    current.status === "ok" ? exhibitionsAtVenue(current.data.items, result.data.slug) : [];
  const hasLocation = Boolean(
    facts.addressLine ||
      facts.hours.length > 0 ||
      result.data.phone ||
      result.data.email ||
      mapsHref,
  );
  return {
    status: "ok",
    data: {
      ...facts,
      body,
      mapsHref,
      hasLocation,
      exhibitions,
      sectionTabs: venueSectionTabs({ location: hasLocation, exhibitions: exhibitions.length > 0 }),
    },
  };
}

export async function composeCollectorHubPage(
  services: Pick<Services<"home">, "editorial">,
): Promise<ArtEditorialPageResult<{ cards: HubFeatureCardVm[] }>> {
  const home = await services.editorial.home();
  if (home.status !== "ok") return passThrough(home);
  return { status: "ok", data: { cards: hubFeatureCards(home.data.placements) } };
}

export type GuideIndexVm = { page: EditorialPageVm; guides: EditorialCardVm[] };

/** The guide index page plus every published story of kind `guide`; a failed list shows none. */
export async function composeGuideIndexPage(
  services: Services<"getPage" | "listStories">,
  slug: string,
): Promise<ArtEditorialPageResult<GuideIndexVm>> {
  const [page, stories] = await Promise.all([
    composeEditorialPage(services, slug),
    services.editorial.listStories({ kind: "guide" }),
  ]);
  if (page.status !== "ok") return page;
  return {
    status: "ok",
    data: {
      page: page.data,
      guides: stories.status === "ok" ? stories.data.items.map(guideCard) : [],
    },
  };
}

export async function composePreviewPage(
  services: Services<"preview">,
  token: string,
): Promise<ArtEditorialPageResult<{ preview: ArtEditorialPreview; body: EditorialBodyVm }>> {
  const result = await services.editorial.preview(token);
  if (result.status !== "ok") return passThrough(result);
  const body = await composeEditorialBody(result.data.body, services, "/");
  return { status: "ok", data: { preview: result.data, body } };
}
