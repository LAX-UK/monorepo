import { artServices } from "@/lib/art-services.server";
import { composeArtHeaderNav } from "@/lib/layout/art-header-nav.composer";
import { cache } from "react";

/** One header-nav read per request; across requests the catalogue fetches are data-cached. */
export const loadArtHeaderNav = cache(() => composeArtHeaderNav(artServices.catalogue));
