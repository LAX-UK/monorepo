import { createHeroPresence } from "@auction/marketing-ui/header/hero-presence";

/**
 * Bid pages whose first section can be a full-bleed cover photograph the header sits over until
 * the page scrolls. The route only says one is possible: the cover itself registers when it is a
 * photograph, so a plate or a type-only cover keeps the header solid.
 */
const HERO_ROUTES: ReadonlySet<string> = new Set(["/"]);

export function bidRouteMayHaveHero(pathname: string): boolean {
  return HERO_ROUTES.has(pathname);
}

/**
 * The server renders the header solid, which reads on every page; it turns transparent once a
 * cover photograph has mounted, before the first paint of the transition.
 */
export const bidHeroPresence = createHeroPresence({ assumedOnServer: false });
