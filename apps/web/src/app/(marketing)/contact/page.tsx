import { ContactForm } from "@/components/marketing/contact-form";
import { LegalH2, LegalPage } from "@/components/marketing/legal-page";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
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
