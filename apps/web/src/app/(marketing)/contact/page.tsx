import { ContactForm } from "@/components/marketing/contact-form";
import { LegalPage } from "@/components/marketing/legal-page";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import { SITE_NAME } from "@/lib/brand";
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
      <LegalPage title="Contact" lastUpdated="21 April 2026" embedded>
        <script type="application/ld+json" suppressHydrationWarning>
          {jsonLdText}
        </script>
        <p>
          Concierge:{" "}
          <a
            href="mailto:concierge@laxauction.house"
            className="text-primary underline-offset-4 hover:underline"
          >
            concierge@laxauction.house
          </a>
        </p>
        <p>
          Telephone:{" "}
          <a href="tel:+442079460958" className="text-primary underline-offset-4 hover:underline">
            +44 20 7946 0958
          </a>{" "}
          (weekdays 09:00–18:00 GMT)
        </p>
        <p className="text-on-surface-variant">
          Registered office: 1 Curator Mews, London W1K 1AA, United Kingdom.
        </p>
        <p className="text-on-surface-variant">
          For bidding support during live phases, signed-in collectors can reach us through their
          dashboard notifications channel. See also{" "}
          <Link href="/shipping" className="text-primary underline-offset-4 hover:underline">
            Shipping & logistics
          </Link>{" "}
          and{" "}
          <Link href="/faq" className="text-primary underline-offset-4 hover:underline">
            FAQs
          </Link>
          .
        </p>

        <h2 id="message" className="!mt-12 scroll-mt-28 font-headline text-2xl text-on-surface">
          Send a message
        </h2>
        <p className="text-on-surface-variant">
          Use the form for buying, selling, shipping, or press — {SITE_NAME} specialists route each
          inquiry to the right desk.
        </p>
        <ContactForm />
      </LegalPage>
    </PolicyHubLayout>
  );
}
