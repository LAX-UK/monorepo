import { artServices } from "@/lib/art-services.server";
import { composeEditorialPage } from "@/lib/editorial/editorial-pages.composer";
import { cache } from "react";

/** One page read per request, shared by `generateMetadata` and the page body. */
export const loadEditorialPage = cache((slug: string) => composeEditorialPage(artServices, slug));
