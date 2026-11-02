import { NOT_FOUND_COPY } from "@/components/not-found/not-found-copy";
import { metadataForNotFound } from "@/lib/seo/metadata-factory";
import { notFound } from "next/navigation";

export const metadata = metadataForNotFound(NOT_FOUND_COPY.page.documentTitle);

/**
 * An address no page claims. An unmatched URL never reaches the public layout on its own, so the
 * 404 would render without the site around it. This catch-all sits in its own group, with the
 * public layout re-exported and no loading boundary: a loading boundary flushes before the page
 * runs and would turn the answer into a 200. Specific routes always win over it.
 */
export default function UnknownPage(): never {
  notFound();
}
