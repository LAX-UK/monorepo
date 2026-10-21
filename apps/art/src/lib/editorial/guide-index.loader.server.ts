import { artServices } from "@/lib/art-services.server";
import { composeGuideIndexPage } from "@/lib/editorial/editorial-pages.composer";
import { cache } from "react";

/** One read per request, shared by `generateMetadata` and the page body. */
export const loadGuideIndex = cache((slug: string) => composeGuideIndexPage(artServices, slug));
