import {
  EditorialLegalBody,
  editorialLegalToc,
} from "@/components/editorial/editorial-block-renderer";
import type {
  ArtEditorialPageResult,
  EditorialPageVm,
} from "@/lib/editorial/editorial-pages.composer";
import { ART_LEGAL_LINKS } from "@/lib/layout/art-legal-links";
import { notFoundOrUnavailable } from "@/lib/seo/page-status";
import { legalEntityFor, legalOperatorSentence } from "@auction/branding";
import { LegalDocument, LegalEntityDetails, LegalHub, LegalSection } from "@auction/marketing-ui";
import { permanentRedirect } from "next/navigation";

const WHO_WE_ARE_ID = "who-we-are";

/**
 * A lax.art legal page on the reading layout every LAX product shares. The text comes from the
 * CMS; "Who we are" names lax.art's operator from `@auction/branding`.
 */
export function ArtLegalPageView({
  result,
  routeFor,
}: {
  result: ArtEditorialPageResult<EditorialPageVm>;
  routeFor: (slug: string) => string;
}) {
  if (result.status !== "ok") notFoundOrUnavailable(result.status, "Page");
  const page = result.data;
  if (page.canonicalPath !== routeFor(page.slug)) permanentRedirect(page.canonicalPath);

  const bodyToc = editorialLegalToc(page.body);
  const toc =
    bodyToc.length > 0 ? [...bodyToc, { id: WHO_WE_ARE_ID, label: "Who we are" }] : undefined;
  const links = ART_LEGAL_LINKS.map((link) => ({
    href: link.href,
    label: link.label,
    current: link.slug === page.slug,
  }));

  return (
    <LegalHub label="Legal" links={links}>
      <LegalDocument title={page.title} {...(toc ? { toc } : {})}>
        <EditorialLegalBody body={page.body} />
        <LegalSection id={WHO_WE_ARE_ID} heading="Who we are">
          <p>{legalOperatorSentence("art")}</p>
          <LegalEntityDetails entities={[legalEntityFor("art")]} />
        </LegalSection>
      </LegalDocument>
    </LegalHub>
  );
}
