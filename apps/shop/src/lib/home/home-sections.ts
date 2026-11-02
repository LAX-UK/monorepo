import {
  type ShopPageSections,
  type ShopSectionSurfaceRule,
  resolveShopPageSections,
} from "@/lib/layout/shop-page-sections";

/** The home page's sections, in page order. */
export type HomeSectionId =
  | "hero"
  | "hang"
  | "browse"
  | "trust"
  | "new-editions"
  | "artists"
  | "collections"
  | "release-alerts"
  | "product-doors"
  | "gallery-team";

/**
 * The surface each section asks for, in page order: the first screen, the trust strip, the new
 * editions, the artists and the ways in stand on the plain page (the paper is only the mat around
 * each work); the gallery team panel is always tinted. The product doors come before the gallery
 * team band, as on lax.art. The release alerts band comes between the ways in and the doors, on the
 * paper tone unless the band sequence gives it to a neighbour.
 */
const HOME_SECTION_SURFACE: Record<HomeSectionId, ShopSectionSurfaceRule<HomeSectionId>> = {
  hero: { surface: "plain", flexible: false },
  hang: { surface: "plain", flexible: false },
  browse: { surface: "plain", flexible: false },
  trust: { surface: "plain", flexible: false },
  "new-editions": { surface: "plain", flexible: false },
  artists: { surface: "plain", flexible: false },
  collections: { surface: "plain", flexible: false },
  "release-alerts": { surface: "band", flexible: true },
  "product-doors": { surface: "plain", flexible: false },
  "gallery-team": { surface: "band", flexible: false },
};

/**
 * Which sections have something to show; the hero, the release alerts and the gallery team always
 * do (alerts matter most when there is little else on the page).
 */
export type HomeSectionContent = Readonly<
  Record<Exclude<HomeSectionId, "hero" | "release-alerts" | "gallery-team">, boolean>
>;

/** The sections the home page shows, in order, and the surface each renders on. */
export function resolveHomeSections(content: HomeSectionContent): ShopPageSections<HomeSectionId> {
  return resolveShopPageSections(HOME_SECTION_SURFACE, {
    ...content,
    hero: true,
    "release-alerts": true,
    "gallery-team": true,
  });
}

/** The id of the "New editions" section, whether it is the hang or the card row. */
export const NEW_EDITIONS_SECTION_ID = "home-new-editions";
