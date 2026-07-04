import { firstString } from "@/lib/admin/admin-list-params";
import {
  ARTIST_DIRECTORY_PRESETS,
  type ArtistDirectoryPreset,
  type ArtistDirectoryPresetId,
  slugifyNationality,
} from "@/lib/artists/directory-presets";
import { artistDirectoryWithQuery } from "@/lib/artists/directory-url";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import type { PublicArtistDirectoryFacets } from "@auction/types";

export type ArtistDirectoryFilterLink = {
  label: string;
  href: string;
  count?: number | undefined;
  active: boolean;
};

export type ArtistDirectoryFilterGroup = {
  id: string;
  title: string;
  links: ArtistDirectoryFilterLink[];
};

export type ArtistDirectoryCarryParams = Record<string, string | null>;

export type ArtistDirectoryFilterRailInput = {
  preset: ArtistDirectoryPreset;
  searchParams: Record<string, string | string[] | undefined>;
  layoutView: CatalogLayoutView;
  facets: PublicArtistDirectoryFacets;
  carry: ArtistDirectoryCarryParams;
  nationality?: string;
  decade?: string;
  nationalityIsLocked: boolean;
  decadeIsLocked: boolean;
  hasUpcoming: boolean;
  categorySlug?: string;
};

/** Path-aware preset chip — preserves `q`, `sort` across slices. Nationality is
 * handled by canonical path-segment URLs so we don't carry it as a query param. */
export function artistDirectoryPresetChips(
  currentId: ArtistDirectoryPresetId,
  sp: Record<string, string | string[] | undefined>,
  layoutView: CatalogLayoutView,
) {
  const carry: ArtistDirectoryCarryParams = {
    q: firstString(sp.q) ?? null,
    sort: firstString(sp.sort) ?? null,
    view: layoutView,
  };
  return ARTIST_DIRECTORY_PRESETS.filter(
    (p) =>
      p.id === "all" ||
      p.id === "featured" ||
      p.id === "living" ||
      p.id === "historical" ||
      p.id === "kind-brands" ||
      p.id === "kind-makers",
  ).map((p) => ({
    id: p.id,
    label: p.label,
    href: artistDirectoryWithQuery(p.canonicalPath, {}, carry),
    active: p.id === currentId,
  }));
}

export function buildArtistDirectoryNationalityHref(
  input: ArtistDirectoryFilterRailInput,
  value: string | null,
): string {
  const { preset, searchParams, carry, layoutView, nationalityIsLocked } = input;
  if (value === null) {
    return nationalityIsLocked
      ? artistDirectoryWithQuery("/artists", {}, carry)
      : artistDirectoryWithQuery(preset.canonicalPath, searchParams, {
          nationality: null,
          offset: null,
          view: layoutView,
        });
  }
  const slug = slugifyNationality(value);
  return artistDirectoryWithQuery(`/artists/nationality/${slug}`, {}, carry);
}

export function buildArtistDirectoryNationalityLinks(
  input: ArtistDirectoryFilterRailInput,
): ArtistDirectoryFilterLink[] | undefined {
  const { facets, nationality } = input;
  if (facets.topNationalities.length === 0) return undefined;
  return [
    {
      label: "Any",
      href: buildArtistDirectoryNationalityHref(input, null),
      active: !nationality,
    },
    ...facets.topNationalities.map((n) => ({
      label: n.value,
      href: buildArtistDirectoryNationalityHref(input, n.value),
      count: n.count,
      active: nationality?.toLowerCase() === n.value.toLowerCase(),
    })),
  ];
}

export function buildArtistDirectoryFilterGroups(
  input: ArtistDirectoryFilterRailInput,
): ArtistDirectoryFilterGroup[] {
  const {
    preset,
    searchParams,
    layoutView,
    facets,
    carry,
    decade,
    decadeIsLocked,
    hasUpcoming,
    categorySlug,
  } = input;
  const sp = searchParams;

  return [
    {
      id: "scenario",
      title: "Scenario",
      links: [
        {
          label: "All",
          href: artistDirectoryWithQuery("/artists", {}, carry),
          count: facets.total,
          active: preset.id === "all",
        },
        {
          label: "Featured",
          href: artistDirectoryWithQuery("/artists/featured", {}, carry),
          count: facets.featured,
          active: preset.id === "featured",
        },
        {
          label: "Living",
          href: artistDirectoryWithQuery("/artists/living", {}, carry),
          count: facets.living,
          active: preset.id === "living",
        },
        {
          label: "Historical",
          href: artistDirectoryWithQuery("/artists/historical", {}, carry),
          count: facets.historical,
          active: preset.id === "historical",
        },
      ],
    },
    {
      id: "kind",
      title: "Kind",
      links: [
        {
          label: "Artists",
          href: artistDirectoryWithQuery("/artists/kind/artists", {}, carry),
          count: facets.byKind.artist,
          active: preset.id === "kind-artists",
        },
        {
          label: "Makers & studios",
          href: artistDirectoryWithQuery("/artists/kind/makers", {}, carry),
          count: facets.byKind.maker,
          active: preset.id === "kind-makers",
        },
        {
          label: "Brands",
          href: artistDirectoryWithQuery("/artists/kind/brands", {}, carry),
          count: facets.byKind.brand,
          active: preset.id === "kind-brands",
        },
        {
          label: "Marques",
          href: artistDirectoryWithQuery("/artists/kind/marques", {}, carry),
          count: facets.byKind.marque,
          active: preset.id === "kind-marques",
        },
      ],
    },
    {
      id: "lots",
      title: "Lots",
      links: [
        {
          label: "Has upcoming lots",
          href: artistDirectoryWithQuery(preset.canonicalPath, sp, {
            hasUpcoming: hasUpcoming ? null : "true",
            offset: null,
            view: layoutView,
          }),
          count: facets.hasUpcoming,
          active: hasUpcoming,
        },
      ],
    },
    ...(facets.topCategories.length > 0 || categorySlug
      ? [
          {
            id: "department",
            title: "Department",
            links: [
              {
                label: "Any department",
                href: artistDirectoryWithQuery(preset.canonicalPath, sp, {
                  category: null,
                  offset: null,
                  view: layoutView,
                }),
                active: !categorySlug,
              },
              ...facets.topCategories.map((c) => ({
                label: c.name,
                href: artistDirectoryWithQuery(preset.canonicalPath, sp, {
                  category: c.slug,
                  offset: null,
                  view: layoutView,
                }),
                count: c.count,
                active: categorySlug === c.slug,
              })),
            ],
          },
        ]
      : []),
    ...(facets.topDecades.length > 0 || decadeIsLocked
      ? [
          {
            id: "decade",
            title: "Born",
            links: [
              {
                label: "Any decade",
                href: decadeIsLocked
                  ? artistDirectoryWithQuery("/artists", {}, carry)
                  : artistDirectoryWithQuery(preset.canonicalPath, sp, {
                      decade: null,
                      offset: null,
                      view: layoutView,
                    }),
                active: !decade,
              },
              ...facets.topDecades.map((d) => ({
                label: d.label,
                href: artistDirectoryWithQuery(`/artists/decade/${d.key}`, {}, carry),
                count: d.count,
                active: decade === d.key,
              })),
            ],
          },
        ]
      : []),
  ];
}
