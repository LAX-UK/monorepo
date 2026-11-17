import { ART_HOME_METADATA, ArtHomePage } from "@/components/home/art-home-page";

export const metadata = ART_HOME_METADATA;

/**
 * The prerendered home page every document request for `/` is served from (middleware rewrites
 * it here; the address bar keeps `/`, and a direct visit to this path is redirected to `/`). It has
 * no loading boundary, so its HTML carries the hero and every section inline, for visitors and
 * crawlers without JavaScript.
 *
 * Regenerated at most every 5 minutes (sooner when a catalogue or editorial read it uses has a
 * shorter period), and at once when shop-api revalidates the `art:home` tag after a write that
 * changes it. Nothing in this render may read cookies, headers or the session: CI fails if this
 * route stops being prerendered (apps/art/scripts/check-prerendered-routes.mjs).
 */
export const revalidate = 300;

export default ArtHomePage;
