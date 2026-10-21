import type {
  ArtEditorialExhibitionSummary,
  ArtEditorialPlacement,
  ArtEditorialStorySummary,
} from "@/lib/editorial/art-editorial.types";
import { editorialPageHref } from "@/lib/editorial/editorial-page-routes";
import { isSafeEditorialHref } from "@auction/shop-contracts";

export type EditorialCardVm = {
  key: string;
  href: string | null;
  headline: string;
  kicker: string | null;
  meta: string | null;
  imageUrl: string | null;
};

type PlacementSlot = ArtEditorialPlacement["slot"];

const REF_ROUTES: Record<string, (slug: string) => string> = {
  exhibition: (slug) => `/exhibitions/${encodeURIComponent(slug)}`,
  story: (slug) => `/stories/${encodeURIComponent(slug)}`,
  page: editorialPageHref,
  venue: (slug) => `/visit/${encodeURIComponent(slug)}`,
};

const REF_KICKERS: Record<string, string> = {
  exhibition: "Exhibition",
  story: "Story",
  page: "Guide",
  venue: "Visit",
};

const STORY_KICKERS: Record<ArtEditorialStorySummary["kind"], string> = {
  article: "Story",
  film: "Film",
  press: "Press",
  guide: "Guide",
  podcast: "Podcast",
};

const EXHIBITION_KICKERS: Record<ArtEditorialExhibitionSummary["kind"], string> = {
  exhibition: "Exhibition",
  film: "Film",
  event: "Event",
};

/** Explicit safe link wins; otherwise the referenced entity's Art route. */
export function placementHref(placement: ArtEditorialPlacement): string | null {
  if (isSafeEditorialHref(placement.linkUrl)) return placement.linkUrl;
  const route = REF_ROUTES[placement.refKind];
  return route && placement.refSlug ? route(placement.refSlug) : null;
}

export function buildPlacementCards(
  placements: readonly ArtEditorialPlacement[],
  slot: PlacementSlot,
  fallbackHeadline: string,
): EditorialCardVm[] {
  return placements
    .filter((placement) => placement.slot === slot)
    .sort((a, b) => a.position - b.position)
    .map((placement) => ({
      key: `${placement.slot}-${placement.position}`,
      href: placementHref(placement),
      headline: placement.headline?.trim() || fallbackHeadline,
      kicker: REF_KICKERS[placement.refKind] ?? null,
      meta: null,
      imageUrl: placement.mediaUrl,
    }));
}

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function parseIsoDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** “12 Mar – 4 May 2026”, “From 12 Mar 2026”, “Until 4 May 2026”; null when undated. */
export function formatExhibitionDates(
  startsOn: string | null,
  endsOn: string | null,
): string | null {
  const start = parseIsoDate(startsOn);
  const end = parseIsoDate(endsOn);
  if (start && end) {
    if (start.getTime() === end.getTime()) return DAY_MONTH_YEAR.format(start);
    const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
    const from = sameYear ? DAY_MONTH.format(start) : DAY_MONTH_YEAR.format(start);
    return `${from} – ${DAY_MONTH_YEAR.format(end)}`;
  }
  if (start) return `From ${DAY_MONTH_YEAR.format(start)}`;
  if (end) return `Until ${DAY_MONTH_YEAR.format(end)}`;
  return null;
}

export function exhibitionCard(item: ArtEditorialExhibitionSummary): EditorialCardVm {
  return {
    key: item.slug,
    href: `/exhibitions/${encodeURIComponent(item.slug)}`,
    headline: item.title,
    kicker: EXHIBITION_KICKERS[item.kind],
    meta: formatExhibitionDates(item.startsOn, item.endsOn),
    imageUrl: item.coverUrl,
  };
}

export function storyCard(item: ArtEditorialStorySummary): EditorialCardVm {
  return {
    key: item.slug,
    href: `/stories/${encodeURIComponent(item.slug)}`,
    headline: item.title,
    kicker: STORY_KICKERS[item.kind],
    meta: item.standfirst,
    imageUrl: item.coverUrl,
  };
}

export function storyKindLabel(kind: ArtEditorialStorySummary["kind"]): string {
  return STORY_KICKERS[kind];
}

export function exhibitionKindLabel(kind: ArtEditorialExhibitionSummary["kind"]): string {
  return EXHIBITION_KICKERS[kind];
}
