import { ContactForm } from "@/components/marketing/contact-form";
import { LegalH2, LegalPage, LegalUL } from "@/components/marketing/legal-page";
import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import { SITE_CONTACT_EMAIL, SITE_TELEPHONE_DISPLAY, SITE_TELEPHONE_HREF } from "@/lib/brand";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { PRIVATE_SALES_PATH } from "@/lib/marketing/private-sales";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForStatic({
  title: "Private sales",
  description:
    "Buy or sell a work privately, outside the auction calendar. A specialist handles every enquiry in confidence.",
  path: PRIVATE_SALES_PATH,
});

export default function PrivateSalesPage() {
  const jsonLdText = jsonLdScript(
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Selling with LAX.BID", path: "/sell" },
      { name: "Private sales", path: PRIVATE_SALES_PATH },
    ]),
  );

  return (
    <PolicyHubLayout>
      <script type="application/ld+json" suppressHydrationWarning>
        {jsonLdText}
      </script>
      <LegalPage
        title="Private sales"
        breadcrumb={
          <MarketingBreadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Selling", href: "/sell" },
              { label: "Private sales", current: true },
            ]}
            className={MARKETING_HUB_BREADCRUMB_CLASS}
          />
        }
        kicker="Selling"
        embedded
      >
        <p>
          A private sale is a sale agreed with a specialist, away from the auction calendar. There
          is no catalogue to browse: each work is introduced to the right buyer, in confidence.
        </p>

        <LegalH2>How it works</LegalH2>
        <LegalUL>
          <li>
            <strong>To sell,</strong> tell us about the work. A specialist reviews it and advises
            whether a private sale or an auction suits it better.
          </li>
          <li>
            <strong>To buy,</strong> tell us what you are looking for. We introduce works as they
            become available and keep your interest private.
          </li>
          <li>Terms, timing and price are agreed with you directly before anything is arranged.</li>
        </LegalUL>

        <LegalH2 id="enquiry" className="scroll-mt-28">
          Make an enquiry
        </LegalH2>
        <p className="text-on-surface-variant">
          Tell us whether you would like to buy or sell, and describe the work or the kind of work
          you are after. We reply within two business days (GMT).
        </p>
        <ContactForm intent="private-sale" />

        <p className="mt-10 border-t border-divider-soft pt-6 font-body text-sm text-on-surface-variant">
          Prefer to speak to someone? Email{" "}
          <a href={`mailto:${SITE_CONTACT_EMAIL}`} className={MARKETING_PROSE_LINK}>
            {SITE_CONTACT_EMAIL}
          </a>{" "}
          or call{" "}
          <a href={`tel:${SITE_TELEPHONE_HREF}`} className={MARKETING_PROSE_LINK}>
            {SITE_TELEPHONE_DISPLAY}
          </a>{" "}
          on weekdays, 09:00 to 18:00 GMT.
        </p>
      </LegalPage>
    </PolicyHubLayout>
  );
}
