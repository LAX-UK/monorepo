import {
  type ShopPageSections,
  type ShopSectionSurfaceRule,
  resolveShopPageSections,
} from "@/lib/layout/shop-page-sections";

/** The home page's sections, in page order. */
export type HomeSectionId =
  | "hero"
  | "trust"
  | "new-editions"
  | "story"
  | "artists"
  | "collections"
  | "product-doors"
  | "gallery-team";

/**
 * The surface each section asks for, in page order. The release sits on the paper wall and the
 * gallery team panel is always tinted; every section between them stands on the plain page. The
 * product doors come before the gallery team band, as on lax.art.
 */
const HOME_SECTION_SURFACE: Record<HomeSectionId, ShopSectionSurfaceRule<HomeSectionId>> = {
  hero: { surface: "band", flexible: false },
  trust: { surface: "plain", flexible: false },
  "new-editions": { surface: "plain", flexible: false },
  story: { surface: "plain", flexible: false },
  artists: { surface: "plain", flexible: false },
  collections: { surface: "plain", flexible: false },
  "product-doors": { surface: "plain", flexible: false },
  "gallery-team": { surface: "band", flexible: false },
};

/** Which sections have something to show; the hero and the gallery team always do. */
export type HomeSectionContent = Readonly<
  Record<Exclude<HomeSectionId, "hero" | "gallery-team">, boolean>
>;

/** The sections the home page shows, in order, and the surface each renders on. */
export function resolveHomeSections(content: HomeSectionContent): ShopPageSections<HomeSectionId> {
  return resolveShopPageSections(HOME_SECTION_SURFACE, {
    ...content,
    hero: true,
    "gallery-team": true,
  });
}
