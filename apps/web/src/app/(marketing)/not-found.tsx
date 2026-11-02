import { NOT_FOUND_COPY } from "@/components/not-found/not-found-copy";
import { PageNotFound } from "@/components/not-found/page-not-found";
import { metadataForNotFound } from "@/lib/seo/metadata-factory";

export const metadata = metadataForNotFound(NOT_FOUND_COPY.page.documentTitle);

export default function MarketingNotFound() {
  return <PageNotFound kind="page" />;
}
