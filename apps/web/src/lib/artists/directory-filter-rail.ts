import { type ArtistDirectoryPreset, slugifyNationality } from "@/lib/artists/directory-presets";
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
  return facets.topNationalities.map((n) => {
    const active = nationality?.toLowerCase() === n.value.toLowerCase();
    return {
      label: n.value,
      href: buildArtistDirectoryNationalityHref(input, active ? null : n.value),
      count: n.count,
      active,
    };
  });
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

  // Every option is a checkbox: choosing one opens its page, choosing it again goes back to all.
  const all = artistDirectoryWithQuery("/artists", {}, carry);
  const presetLink = (
    label: string,
    presetId: string,
    path: string,
    count: number | undefined,
  ): ArtistDirectoryFilterLink => {
    const active = preset.id === presetId;
    return {
      label,
      href: active ? all : artistDirectoryWithQuery(path, {}, carry),
      count,
      active,
    };
  };

  return [
    {
      id: "show",
      title: "Show",
      links: [presetLink("Featured", "featured", "/artists/featured", facets.featured)],
    },
    {
      id: "scenario",
      title: "Living or historical",
      links: [
        presetLink("Living", "living", "/artists/living", facets.living),
        presetLink("Historical", "historical", "/artists/historical", facets.historical),
      ],
    },
    {
      id: "kind",
      title: "Type",
      links: [
        presetLink("Artists", "kind-artists", "/artists/kind/artists", facets.byKind.artist ?? 0),
        presetLink(
          "Makers and studios",
          "kind-makers",
          "/artists/kind/makers",
          facets.byKind.maker,
        ),
        presetLink("Brands", "kind-brands", "/artists/kind/brands", facets.byKind.brand ?? 0),
        presetLink("Marques", "kind-marques", "/artists/kind/marques", facets.byKind.marque ?? 0),
      ],
    },
    {
      id: "lots",
      title: "Has works on sale",
      links: [
        {
          label: "Only these artists",
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
              ...facets.topCategories.map((c) => ({
                label: c.name,
                href: artistDirectoryWithQuery(preset.canonicalPath, sp, {
                  category: categorySlug === c.slug ? null : c.slug,
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
              ...facets.topDecades.map((d) => {
                const active = decade === d.key;
                return {
                  label: d.label,
                  href: active
                    ? decadeIsLocked
                      ? all
                      : artistDirectoryWithQuery(preset.canonicalPath, sp, {
                          decade: null,
                          offset: null,
                          view: layoutView,
                        })
                    : artistDirectoryWithQuery(`/artists/decade/${d.key}`, {}, carry),
                  count: d.count,
                  active,
                };
              }),
            ],
          },
        ]
      : []),
  ];
}
