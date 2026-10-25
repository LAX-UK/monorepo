import { ArtLegalIndexView, artLegalIndexMetadata } from "@/components/legal/art-policy-page-view";

/** Policy visibility depends on the deployment, so the page is rendered per request. */
export const dynamic = "force-dynamic";

export const metadata = artLegalIndexMetadata;

export default function LegalIndexPage() {
  return <ArtLegalIndexView />;
}
