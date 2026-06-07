import { ContactForm } from "@/components/marketing/contact-form";
import { LegalH2, LegalPage } from "@/components/marketing/legal-page";
import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import {
  SITE_BUSINESS_ADDRESS_INLINE,
  SITE_BUSINESS_ADDRESS_LINES,
  SITE_CONTACT_EMAIL,
  SITE_PRESS_EMAIL,
  SITE_SUPPORT_EMAIL,
  SITE_TELEPHONE_DISPLAY,
  SITE_TELEPHONE_HREF,
} from "@/lib/brand";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, jsonLdScript, localBusinessJsonLd } from "@/lib/seo/structured-data";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "Contact",
  description:
    "Contact LAX.BID by London Art Exchange for bidding, consignments, platform support, press, and media.",
  path: "/contact",
});

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const intent = sp.intent ?? null;
  const type = sp.type ?? null;
  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Contact", path: "/contact" },
  ]);
  const biz = localBusinessJsonLd();
  const jsonLdText = jsonLdScript(crumbs, biz);

  return (
    <PolicyHubLayout>
      <LegalPage
        title="Contact"
        breadcrumb={
          <MarketingBreadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Contact", current: true },
            ]}
            className={MARKETING_HUB_BREADCRUMB_CLASS}
          />
        }
        lastUpdated="21 April 2026"
        kicker={null}
        dividerUnderDate
        embedded
      >
        <script type="application/ld+json" suppressHydrationWarning>
          {jsonLdText}
        </script>
        <p>
          For all enquiries relating to bidding, consignments, or general platform support, please
          contact our team directly.
        </p>

        <LegalH2>Client Services</LegalH2>
        <p>
          General enquiries:{" "}
          <a href={`mailto:${SITE_CONTACT_EMAIL}`} className={MARKETING_PROSE_LINK}>
            {SITE_CONTACT_EMAIL}
          </a>
        </p>
        <p>
          Telephone:{" "}
          <a href={`tel:${SITE_TELEPHONE_HREF}`} className={MARKETING_PROSE_LINK}>
            {SITE_TELEPHONE_DISPLAY}
          </a>{" "}
          (Weekdays, 09:00 - 18:00 GMT)
        </p>

        <LegalH2>Support</LegalH2>
        <p>
          For platform-related assistance, account queries, or technical support, our team is
          available on a continuous basis.
        </p>
        <p>
          Email:{" "}
          <a href={`mailto:${SITE_SUPPORT_EMAIL}`} className={MARKETING_PROSE_LINK}>
            {SITE_SUPPORT_EMAIL}
          </a>
        </p>

        <LegalH2>Press &amp; Media</LegalH2>
        <p>For press enquiries, editorial features, or partnership discussions, please contact:</p>
        <p>
          Email:{" "}
          <a href={`mailto:${SITE_PRESS_EMAIL}`} className={MARKETING_PROSE_LINK}>
            {SITE_PRESS_EMAIL}
          </a>
        </p>

        <LegalH2>Registered Office</LegalH2>
        <address className="not-italic">
          {SITE_BUSINESS_ADDRESS_LINES.map((line) => (
            <span key={line}>
              {line}
              <br />
            </span>
          ))}
        </address>

        <LegalH2 id="message" className="scroll-mt-28">
          Enquiries
        </LegalH2>
        <p className="text-on-surface-variant">
          For buying, selling, shipping, or press-related enquiries, please use the contact form
          below. All submissions are reviewed and directed to the appropriate department.
        </p>
        <p className="text-on-surface-variant">
          Our team will respond in due course with the relevant information or next steps.
        </p>
        <ContactForm intent={intent} sellType={type} />

        <aside className="mt-10 border-t border-divider-soft pt-6 font-body text-sm text-on-surface-variant">
          For bidding support during live phases, signed-in collectors can reach us through their{" "}
          <Link href="/dashboard" className={MARKETING_PROSE_LINK}>
            dashboard
          </Link>{" "}
          notifications channel. See also{" "}
          <Link href="/shipping" className={MARKETING_PROSE_LINK}>
            Shipping &amp; Logistics
          </Link>{" "}
          and{" "}
          <Link href="/faq" className={MARKETING_PROSE_LINK}>
            FAQ
          </Link>
          .
          <br />
          Registered office: {SITE_BUSINESS_ADDRESS_INLINE}
        </aside>
      </LegalPage>
    </PolicyHubLayout>
  );
}
