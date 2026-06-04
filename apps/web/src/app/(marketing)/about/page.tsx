import { LegalH2, LegalPage } from "@/components/marketing/legal-page";
import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import {
  SITE_BUSINESS_ADDRESS_INLINE,
  SITE_BUSINESS_HOURS_LABEL,
  SITE_COMPANY_NAME,
  SITE_NAME,
} from "@/lib/brand";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { policyHubPageJsonLd } from "@/lib/seo/jsonld";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "About",
  description: "Learn about LAX.BID, the dedicated auction platform of London Art Exchange.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <PolicyHubLayout>
      <script type="application/ld+json" suppressHydrationWarning>
        {policyHubPageJsonLd({
          path: "/about",
          breadcrumbName: "About",
          pageName: "About LAX.BID",
          description:
            "Learn about LAX.BID, the dedicated auction platform of London Art Exchange.",
        })}
      </script>
      <LegalPage
        title="About LAX.BID"
        breadcrumb={
          <MarketingBreadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "About", current: true },
            ]}
            className={MARKETING_HUB_BREADCRUMB_CLASS}
          />
        }
        lastUpdated="21 April 2026"
        kicker={null}
        dividerUnderDate
        embedded
      >
        <p>
          {SITE_NAME} is the dedicated auction platform of {SITE_COMPANY_NAME}, developed to
          facilitate the structured sale and acquisition of fine art, rare collectibles, and
          culturally significant assets.
        </p>
        <p>
          Positioned between private transactions and traditional auction houses, the platform
          provides a controlled, digitally native environment for price discovery, liquidity, and
          collector access.
        </p>

        <LegalH2>Our Foundation</LegalH2>
        <p>
          {SITE_COMPANY_NAME} was incorporated in 2020 with the intention of establishing a more
          structured and disciplined approach to the sale of fine art and collectible assets. From
          the outset, the business has operated with a focus on curation, control, and consistency,
          favouring a measured release of works over volume-led distribution.
        </p>
        <p>
          In the years following its incorporation, {SITE_COMPANY_NAME} has engaged with over 200
          private clients, facilitating transactions across both primary and secondary markets,
          alongside a programme of exhibitions and private viewings. This activity has provided a
          foundation not only of client relationships, but of operational experience in managing the
          presentation, pricing, and placement of works within a defined market context.
        </p>
        <p>
          As the business evolved, so too did the requirement for a more formalised and scalable
          sales infrastructure, one capable of supporting increased transaction flow while
          maintaining the same level of oversight and integrity that had defined the company&apos;s
          earlier development.
        </p>

        <LegalH2>Development of LAX.BID</LegalH2>
        <p>
          Planning for {SITE_NAME} commenced in 2024, marking a deliberate transition towards the
          establishment of a dedicated auction environment. This was not approached as an extension
          of existing marketplace models, but rather as the construction of a controlled auction
          platform aligned with the standards and expectations of a contemporary auction house.
        </p>
        <p>
          The development of {SITE_NAME} has followed a considered and extended timeline. As with
          the LAX client platform, lax.art, which required over two years of design and
          implementation, the auction platform has been built through a similarly rigorous process
          of research, structural planning, and operational refinement.
        </p>
        <p>
          Under the direction of Kylie James, this process has encompassed the development of
          auction mechanics, the structuring of sale formats, the integration of registration and
          compliance frameworks, and the design of systems capable of supporting end-to-end
          transaction handling. Particular attention has been given to data architecture and
          catalogue presentation, ensuring that each lot is positioned within a clear and coherent
          framework that supports both buyer confidence and pricing transparency.
        </p>
        <p>
          This measured approach reflects an understanding that an auction platform is not defined
          solely by its interface, but by the discipline of its underlying systems and the clarity
          of its execution.
        </p>

        <LegalH2>Positioning</LegalH2>
        <p>
          {SITE_NAME} represents the progression of {SITE_COMPANY_NAME} into a fully realised
          auction house model. It has been developed to provide a structured environment for the
          sale of carefully selected works and assets, where supply is controlled, presentation is
          considered, and outcomes are determined through transparent bidding mechanisms.
        </p>
        <p>
          In this context, the platform operates not as an open marketplace, but as a curated
          exchange, one designed to deliver consistency, credibility, and a clearly defined standard
          across each sale.
        </p>

        <LegalH2>Registration</LegalH2>
        <p>
          Participation in auctions on {SITE_NAME} requires a verified account. All bidders must be
          aged 18 or over and complete the necessary registration procedures prior to engaging in
          any sale.
        </p>
        <p>
          Verification requirements may vary depending on the nature and value of the transaction,
          and additional documentation may be requested where appropriate. By registering, users
          confirm their acceptance of the{" "}
          <Link href="/terms" className={MARKETING_PROSE_LINK}>
            Conditions of Business
          </Link>{" "}
          and agree to comply with all applicable conditions governing bidding and purchase.
        </p>

        <LegalH2>Our team</LegalH2>
        <p>
          Each sale is managed by a dedicated specialist team responsible for the review,
          preparation, and execution of the catalogue.
        </p>
        <p>
          Consignments are assessed prior to acceptance, with attention given to suitability,
          presentation, and market positioning. Cataloguing is undertaken with a focus on clarity
          and accuracy, including condition reporting and supporting detail where required.
          Oversight of each sale is maintained throughout, from initial intake through to final
          settlement and delivery coordination.
        </p>
        <p>
          All catalogues are subject to internal review prior to publication, ensuring a consistent
          standard across each auction presented on the platform.
        </p>

        <LegalH2>Location</LegalH2>
        <p>
          {SITE_COMPANY_NAME} operates from its Marylebone premises at{" "}
          {SITE_BUSINESS_ADDRESS_INLINE}
          <br />
          {SITE_BUSINESS_HOURS_LABEL}
        </p>
        <p>
          Viewings are conducted by appointment, allowing for a controlled and considered
          environment in which works can be presented. This approach reflects the wider operational
          model of the business, where access, presentation, and client engagement are managed with
          discretion and precision.
        </p>
      </LegalPage>
    </PolicyHubLayout>
  );
}
