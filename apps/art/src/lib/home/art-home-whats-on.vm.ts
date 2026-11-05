import type {
  ArtEditorialExhibitionDetail,
  ArtEditorialExhibitionSummary,
  ArtEditorialPlacement,
} from "@/lib/editorial/art-editorial.types";
import {
  type EditorialCardVm,
  exhibitionKindLabel,
  formatExhibitionDates,
  placementHref,
} from "@/lib/editorial/editorial-card.vm";

/** The lead exhibition as a large card, a second as a smaller one; more are left to "View all". */
export const WHATS_ON_LIMIT = 2;

/** One slot of the section, before its card is built. */
export type WhatsOnPick = {
  placement: ArtEditorialPlacement | null;
  /** The exhibition's slug; null for a placement that is not an exhibition. */
  slug: string | null;
  /** Its list entry, when the current list held it. */
  exhibition: ArtEditorialExhibitionSummary | null;
};

/**
 * What the section shows, in order. Curated `home_whats_on` placements lead; without any, the
 * current exhibitions do, featured ones first (the API order otherwise). A slug appears once.
 */
export function pickWhatsOn(
  placements: readonly ArtEditorialPlacement[],
  current: readonly ArtEditorialExhibitionSummary[],
  limit: number = WHATS_ON_LIMIT,
): WhatsOnPick[] {
  const bySlug = new Map(current.map((item) => [item.slug, item]));
  const curated: WhatsOnPick[] = placements
    .filter((placement) => placement.slot === "home_whats_on")
    .sort((a, b) => a.position - b.position)
    .map((placement) => {
      const slug = placement.refKind === "exhibition" ? placement.refSlug : null;
      return { placement, slug, exhibition: slug ? (bySlug.get(slug) ?? null) : null };
    });
  const picks: WhatsOnPick[] =
    curated.length > 0
      ? curated
      : [...current]
          .sort((a, b) => Number(b.featured) - Number(a.featured))
          .map((exhibition) => ({ placement: null, slug: exhibition.slug, exhibition }));

  const seen = new Set<string>();
  return picks
    .filter((pick) => {
      if (!pick.slug) return true;
      if (seen.has(pick.slug)) return false;
      seen.add(pick.slug);
      return true;
    })
    .slice(0, limit);
}

function trimmed(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

/**
 * The exhibition's own detail is read when its list entry is missing, or when neither the
 * placement nor the exhibition has an image: the detail carries the works and the venue.
 */
export function whatsOnNeedsDetail(pick: WhatsOnPick): boolean {
  if (!pick.slug) return false;
  if (!pick.exhibition) return true;
  return !(trimmed(pick.placement?.mediaUrl) ?? trimmed(pick.exhibition.coverUrl));
}

/** The first work with an image, in the exhibition's curated order. */
export function leadArtworkImage(
  detail: Pick<ArtEditorialExhibitionDetail, "artworks"> | null | undefined,
): string | null {
  for (const artwork of detail?.artworks ?? []) {
    const url = trimmed(artwork.imageUrl);
    if (url) return url;
  }
  return null;
}

function exhibitionPath(slug: string): string {
  return `/exhibitions/${encodeURIComponent(slug)}`;
}

/**
 * Cards for the section. An exhibition's image is the placement's, then its cover, then its lead
 * artwork; one with none still renders its image frame (the kit's hatched placeholder), never a
 * text-only card. The lead carries "Visit" and, for an exhibition, "See the works".
 */
export function buildWhatsOnCards(
  picks: readonly WhatsOnPick[],
  details: ReadonlyMap<string, ArtEditorialExhibitionDetail> = new Map(),
): EditorialCardVm[] {
  return picks.flatMap((pick, index): EditorialCardVm[] => {
    const { placement, slug } = pick;
    const detail = slug ? (details.get(slug) ?? null) : null;
    const source = pick.exhibition ?? detail;
    const href = slug ? exhibitionPath(slug) : placement ? placementHref(placement) : null;
    // A curated link that is not an exhibition may carry no headline of its own.
    const headline =
      trimmed(placement?.headline) ??
      source?.title ??
      (placement && !slug && href ? "What's on" : null);
    if (!headline) return [];

    const imageUrl =
      trimmed(placement?.mediaUrl) ?? trimmed(source?.coverUrl) ?? leadArtworkImage(detail);
    const gallery = trimmed(source?.venue?.name);
    const dates = source ? formatExhibitionDates(source.startsOn, source.endsOn) : null;
    const actions =
      index === 0 && href
        ? [
            { label: "Visit", href },
            ...(slug ? [{ label: "See the works", href: `${href}#works` }] : []),
          ]
        : [];

    return [
      {
        key: placement ? `${placement.slot}-${placement.position}` : (slug ?? headline),
        href,
        headline,
        kicker: source ? exhibitionKindLabel(source.kind) : slug ? "Exhibition" : null,
        kickerDetail: gallery,
        meta: dates,
        imageUrl,
        ...(actions.length > 0 ? { actions } : {}),
      },
    ];
  });
}
