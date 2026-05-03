import { ContactForm } from "@/components/marketing/contact-form";
import { LegalH2, LegalPage } from "@/components/marketing/legal-page";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import {
  SITE_BUSINESS_ADDRESS_INLINE,
  SITE_CONTACT_EMAIL,
  SITE_TELEPHONE_DISPLAY,
  SITE_TELEPHONE_HREF,
} from "@/lib/brand";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, jsonLdScript, localBusinessJsonLd } from "@/lib/seo/structured-data";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "Contact",
  description:
    "Contact LAX London Auction House Ltd — concierge, specialist inquiries, and support.",
  path: "/contact",
});

export default function ContactPage() {
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
        lastUpdated="21 April 2026"
        kicker={null}
        dividerUnderDate
        embedded
      >
        <script type="application/ld+json" suppressHydrationWarning>
          {jsonLdText}
        </script>
        <p>
          Concierge:{" "}
          <a
            href={`mailto:${SITE_CONTACT_EMAIL}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            {SITE_CONTACT_EMAIL}
          </a>
        </p>
        <p>
          Telephone:{" "}
          <a
            href={`tel:${SITE_TELEPHONE_HREF}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            {SITE_TELEPHONE_DISPLAY}
          </a>{" "}
          (weekdays 09:00–18:00 GMT)
        </p>
        <p className="text-on-surface-variant">Registered office: {SITE_BUSINESS_ADDRESS_INLINE}</p>

        <LegalH2 id="message" className="scroll-mt-28">
          Send a message
        </LegalH2>
        <p className="text-on-surface-variant">
          Use the form below for buying, selling, shipping, or press enquiries. Our specialists
          route each enquiry to the right desk.
        </p>
        <ContactForm />

        <aside className="mt-10 border-t border-divider-soft pt-6 font-body text-sm text-on-surface-variant">
          For bidding support during live phases, signed-in collectors can reach us through their{" "}
          <Link href="/dashboard" className="text-primary underline-offset-4 hover:underline">
            dashboard
          </Link>{" "}
          notifications channel. See also{" "}
          <Link href="/shipping" className="text-primary underline-offset-4 hover:underline">
            Shipping &amp; logistics
          </Link>{" "}
          and{" "}
          <Link href="/faq" className="text-primary underline-offset-4 hover:underline">
            FAQs
          </Link>
          .
        </aside>
      </LegalPage>
    </PolicyHubLayout>
  );
}
