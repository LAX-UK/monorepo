/*
 * Routes whose first section can be a full-bleed hero image (Figma home 235:225, medium landings
 * 587:9412, artist 439:6125, exhibition 743:20964, and the "Page titel" media band used by
 * stories and venues). On these the header sits over the hero until the page scrolls.
 *
 * The route only says a hero is possible: each page drops it when its record has no image, and
 * `ArtHeroSignal` then keeps the header solid. `/artworks` is left out on purpose: its hero
 * depends on a query parameter the server-rendered header cannot see, so it would flash.
 */
const HERO_ROUTES: ReadonlySet<string> = new Set(["/", "/paintings", "/prints", "/sculptures"]);
const HERO_DETAIL_PREFIXES: readonly string[] = [
  "/artists/",
  "/exhibitions/",
  "/stories/",
  "/visit/",
];

export function artRouteMayHaveHero(pathname: string): boolean {
  if (HERO_ROUTES.has(pathname)) return true;
  return HERO_DETAIL_PREFIXES.some(
    (prefix) => pathname.startsWith(prefix) && pathname.length > prefix.length,
  );
}

/**
 * Applied to a hero that starts under the fixed header. The layout pads `main` by the header
 * height, so the hero pulls itself up by the same amount and adds it back as its own top padding;
 * page flow and the position of the hero's content stay where they were.
 */
export const ART_HERO_UNDER_HEADER_CLASS =
  "-mt-[calc(var(--header-height)+env(safe-area-inset-top,0px))] pt-[calc(var(--header-height)+env(safe-area-inset-top,0px)+2rem)]";
