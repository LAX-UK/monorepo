import type {
  ArtEditorialExhibitionDetail,
  ArtEditorialExhibitionSummary,
  ArtEditorialFetchResult,
  ArtEditorialPreview,
  ArtEditorialStoryDetail,
  ArtEditorialVenueDetail,
  ArtExhibitionStatus,
} from "@/lib/editorial/art-editorial.types";
import {
  type EditorialBodyVm,
  composeEditorialBody,
} from "@/lib/editorial/editorial-body.composer";
import {
  type EditorialCardVm,
  buildPlacementCards,
  exhibitionCard,
  exhibitionKindLabel,
  formatExhibitionDates,
  storyCard,
} from "@/lib/editorial/editorial-card.vm";
import { editorialPageHref } from "@/lib/editorial/editorial-page-routes";
import { exhibitionHasEnded, exhibitionMetaLine } from "@/lib/editorial/editorial-page-title.vm";
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
  /** Featured current and upcoming shows, whichever tab is active. */
  featured: EditorialCardVm[];
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
  const featured = [...featuredBySlug.values()]
    .slice(0, FEATURED_EXHIBITIONS_LIMIT)
    .map(exhibitionCard);
  return {
    status: "ok",
    data: { status, cards: result.data.items.map(exhibitionCard), featured },
  };
}

export type ExhibitionDetailVm = {
  exhibition: ArtEditorialExhibitionDetail;
  /** Page title byline, e.g. "Exhibition · 18 Aug – 27 Aug 2026". */
  metaLine: string;
  /** Past its end date: the title shows "Closed" (Figma 737:20593). */
  ended: boolean;
  dateLabel: string | null;
  venueName: string | null;
  venueHref: string | null;
  hoursLabel: string | null;
  body: EditorialBodyVm;
};

export async function composeExhibitionDetailPage(
  services: Services<"getExhibition" | "getVenue">,
  slug: string,
): Promise<ArtEditorialPageResult<ExhibitionDetailVm>> {
  const result = await services.editorial.getExhibition(slug);
  if (result.status !== "ok") return passThrough(result);
  const exhibition = result.data;
  const returnTo = `/exhibitions/${encodeURIComponent(exhibition.slug)}`;
  const [venueResult, body] = await Promise.all([
    exhibition.venueSlug ? services.editorial.getVenue(exhibition.venueSlug) : null,
    composeEditorialBody(exhibition.body, services, returnTo),
  ]);
  const venueHours =
    venueResult?.status === "ok"
      ? presentOpeningHours(venueResult.data.openingHours)
          .map((row) => `${row.label} ${row.value}`)
          .join(" · ")
      : "";
  const dateLabel = formatExhibitionDates(exhibition.startsOn, exhibition.endsOn);
  return {
    status: "ok",
    data: {
      exhibition,
      metaLine: exhibitionMetaLine(exhibitionKindLabel(exhibition.kind), dateLabel),
      ended: exhibitionHasEnded(exhibition.endsOn, new Date()),
      dateLabel,
      venueName: venueResult?.status === "ok" ? venueResult.data.name : null,
      venueHref: venueResult?.status === "ok" ? venueHref(venueResult.data.slug) : null,
      hoursLabel: exhibition.timesNote?.trim() || venueHours || null,
      body,
    },
  };
}

export async function composeStoryPage(
  services: Services<"getStory">,
  slug: string,
): Promise<
  ArtEditorialPageResult<{ story: ArtEditorialStoryDetail; kicker: string; body: EditorialBodyVm }>
> {
  const result = await services.editorial.getStory(slug);
  if (result.status !== "ok") return passThrough(result);
  const story = result.data;
  const body = await composeEditorialBody(
    story.body,
    services,
    `/stories/${encodeURIComponent(story.slug)}`,
  );
  return { status: "ok", data: { story, kicker: storyCard(story).kicker ?? "Story", body } };
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

export type VenueCardVm = VenueFactsVm & { href: string };

export type VisitPageVm = { venues: VenueCardVm[] };

export type VenuePageVm = VenueFactsVm & { body: EditorialBodyVm };

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

/** Published venues with address and hours; venues whose detail read fails are skipped. */
export async function composeVisitPage(
  services: Pick<Services<"listVenues" | "getVenue">, "editorial">,
): Promise<ArtEditorialPageResult<VisitPageVm>> {
  const list = await services.editorial.listVenues();
  if (list.status !== "ok") return passThrough(list);
  const details = await Promise.all(
    list.data.items
      .slice(0, VISIT_VENUES_LIMIT)
      .map((item) => services.editorial.getVenue(item.slug)),
  );
  const venues = details.flatMap((detail) =>
    detail.status === "ok"
      ? [{ ...venueFacts(detail.data), href: venueHref(detail.data.slug) }]
      : [],
  );
  if (list.data.items.length > 0 && venues.length === 0) return { status: "error" };
  return { status: "ok", data: { venues } };
}

export async function composeVenuePage(
  services: Services<"getVenue">,
  slug: string,
): Promise<ArtEditorialPageResult<VenuePageVm>> {
  const result = await services.editorial.getVenue(slug);
  if (result.status !== "ok") return passThrough(result);
  const body = await composeEditorialBody(result.data.body, services, venueHref(result.data.slug));
  return { status: "ok", data: { ...venueFacts(result.data), body } };
}

export type HubPageVm = { spotlight: EditorialCardVm[]; stories: EditorialCardVm[] };

export async function composeArtHubPage(
  services: Pick<Services<"home" | "listStories">, "editorial">,
): Promise<ArtEditorialPageResult<HubPageVm>> {
  const [home, stories] = await Promise.all([
    services.editorial.home(),
    services.editorial.listStories(),
  ]);
  if (home.status !== "ok" && stories.status !== "ok") return passThrough(home);
  return {
    status: "ok",
    data: {
      spotlight:
        home.status === "ok"
          ? buildPlacementCards(home.data.placements, "art_hub_spotlight", "Featured story")
          : [],
      stories: stories.status === "ok" ? stories.data.items.map(storyCard) : [],
    },
  };
}

export async function composeCollectorHubPage(
  services: Pick<Services<"home">, "editorial">,
): Promise<ArtEditorialPageResult<{ cards: EditorialCardVm[] }>> {
  const home = await services.editorial.home();
  if (home.status !== "ok") return passThrough(home);
  return {
    status: "ok",
    data: {
      cards: buildPlacementCards(home.data.placements, "collector_hub_card", "Collector resource"),
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
