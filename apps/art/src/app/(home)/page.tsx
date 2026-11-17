import { ART_HOME_METADATA, ArtHomePage } from "@/components/home/art-home-page";

export const metadata = ART_HOME_METADATA;

/**
 * The home page for in-app navigation: rendered per request, so the router prefetches it only down
 * to `loading.tsx` and shows that loading screen while the page streams in (MO12). A document
 * request for `/` (a first visit, a crawler, JavaScript off) never reaches this route: middleware
 * serves it the prerendered copy (`app/prerendered/home`), whose HTML carries the page itself.
 */
export const dynamic = "force-dynamic";

export default ArtHomePage;
