import {
  kindDirectorySlug,
  normalizeDecadeSegment,
  slugifyNationality,
} from "@/lib/artists/directory-presets";
import type { SessionUser } from "@/lib/data/contracts";
import { portraitForPublicArtist } from "@/lib/data/http/artist.server";
import { artistDirectoryBackHref } from "@/lib/marketing/catalog-links";
import { artistPath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type {
  Lot,
  PublicArtistDirectoryRow,
  ArtistProfile as RegistryArtist,
} from "@auction/types";
import { getCreatorKindConfig } from "@auction/types";

export type ArtistPivotChip = { href: string; label: string; aria: string };

export type ArtistAttributeRow = { label: string; value: string };

export type ArtistDetailPageVM = {
  id: string;
  registry: RegistryArtist;
  artistLots: Lot[];
  aliasesList: string[];
  session: SessionUser | null;
  watchedArtistIds: string[];
  directoryBackHref: string;
  artistName: string;
  artistTagline: string | null;
  artistBio: string | null;
  artistPortraitUrl: string | null;
  currentUserId: string | null;
  profilePath: string;
  profileUrl: string;
  isFeatured: boolean;
  watching: boolean;
  isAuthed: boolean;
  kindConfig: ReturnType<typeof getCreatorKindConfig>;
  pivotChips: ArtistPivotChip[];
  categoryChips: Array<{ id: string; name: string; slug: string }>;
  attributeRows: ArtistAttributeRow[];
  relatedRows: PublicArtistDirectoryRow[];
  browseHref: string;
  breadcrumbItems: Array<{ label: string; href?: string; current?: boolean }>;
};

export type BuildArtistPageVMInput = {
  id: string;
  slug: string;
  searchParams: Record<string, string | string[] | undefined>;
  artistLots: Lot[];
  registry: RegistryArtist;
  aliases: string[];
  session: SessionUser | null;
  watchedArtistIds: string[];
  relatedRows: PublicArtistDirectoryRow[];
};

export function buildArtistPageVM(input: BuildArtistPageVMInput): ArtistDetailPageVM {
  const { id, registry, artistLots, aliases, session, watchedArtistIds, relatedRows } = input;
  const directoryBackHref = artistDirectoryBackHref(input.searchParams);

  const artistName = registry.displayName;
  const artistTagline = registry.nationality?.trim() || null;
  const artistBio = registry.shortBio?.trim() || registry.longBio?.trim() || null;
  const artistPortraitUrl = portraitForPublicArtist(registry.portraitUrl);
  const currentUserId = session?.id ?? null;
  const base = getSiteUrl();
  const isFeatured = registry.featured === true;
  const watching = watchedArtistIds.includes(id);
  const isAuthed = Boolean(session);

  const profilePath = artistPath({ id: registry.id, name: artistName });
  const profileUrl = `${base}${profilePath}`;

  const kindConfig = getCreatorKindConfig(registry.kind);
  const aliasesList = aliases.slice(0, 6);

  const kindSegment: string | null = registry.kind ? kindDirectorySlug(registry.kind) : null;
  const browseHref = kindSegment ? `/artists/kind/${kindSegment}` : "/artists";

  const birthMatch = registry.birthYear?.match(/^\d{4}/);
  const birthYearNum = birthMatch?.[0] != null ? Number.parseInt(birthMatch[0], 10) : null;
  const decadeSlug = (() => {
    if (birthYearNum == null) return null;
    if (birthYearNum < 1800) return "pre-1800";
    const start = Math.floor(birthYearNum / 10) * 10;
    return normalizeDecadeSegment(`${start}s`);
  })();

  const pivotChips: ArtistPivotChip[] = [];
  if (decadeSlug) {
    pivotChips.push({
      href: `/artists/decade/${decadeSlug}`,
      label: decadeSlug === "pre-1800" ? "Born before 1800" : `Born in the ${decadeSlug}`,
      aria: `Browse artists born in the ${decadeSlug === "pre-1800" ? "pre-1800 era" : decadeSlug}`,
    });
  }
  if (registry.nationality?.trim()) {
    const nat = registry.nationality.trim();
    const natSlug = slugifyNationality(nat);
    pivotChips.push({
      href: `/artists/nationality/${natSlug}`,
      label: nat,
      aria: `Browse ${nat} artists`,
    });
  }
  if (kindSegment) {
    pivotChips.push({
      href: `/artists/kind/${kindSegment}`,
      label: `More ${kindConfig.pluralLabel.toLowerCase()}`,
      aria: `Browse all ${kindConfig.pluralLabel.toLowerCase()}`,
    });
  }

  const categoryChips = (registry.categories ?? []).slice(0, 6);

  const attributeRows = kindConfig.attributes
    .map((field) => ({
      label: field.label,
      value: registry.attributes?.[field.key]?.trim() ?? "",
    }))
    .filter((entry) => entry.value.length > 0);

  return {
    id,
    registry,
    artistLots,
    aliasesList,
    session,
    watchedArtistIds,
    directoryBackHref,
    artistName,
    artistTagline,
    artistBio,
    artistPortraitUrl,
    currentUserId,
    profilePath,
    profileUrl,
    isFeatured,
    watching,
    isAuthed,
    kindConfig,
    pivotChips,
    categoryChips,
    attributeRows,
    relatedRows,
    browseHref,
    breadcrumbItems: [
      { label: "Home", href: "/" },
      { label: "Artists", href: "/artists" },
      { label: artistName, current: true },
    ],
  };
}
