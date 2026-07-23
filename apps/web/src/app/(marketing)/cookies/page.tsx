import { LegalH2, LegalPage, LegalUL } from "@/components/marketing/legal-page";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import { SITE_NAME } from "@/lib/brand";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { policyHubPageJsonLd } from "@/lib/seo/jsonld";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "Cookie policy",
  description: `How ${SITE_NAME} uses cookies, Google Tag Manager, and Google Analytics with consent controls.`,
  path: "/cookies",
});

const toc = [
  { id: "overview", label: "Overview" },
  { id: "categories", label: "Categories" },
  { id: "third-parties", label: "Third parties" },
  { id: "manage", label: "Manage preferences" },
] as const;

export default function CookiesPage() {
  return (
    <PolicyHubLayout>
      <script type="application/ld+json" suppressHydrationWarning>
        {policyHubPageJsonLd({
          path: "/cookies",
          breadcrumbName: "Cookie policy",
          pageName: "Cookie policy",
          description: `How ${SITE_NAME} uses cookies, Google Tag Manager, and Google Analytics with consent controls.`,
        })}
      </script>
      <LegalPage
        title="Cookie policy"
        toc={[...toc]}
        lastUpdated="23 July 2026"
        kicker={null}
        dividerUnderDate
        embedded
      >
        <LegalH2 id="overview" className="scroll-mt-28">
          Overview
        </LegalH2>
        <p>
          This policy explains how {SITE_NAME} uses cookies and similar technologies, what
          categories we use, and how you can control optional cookies. It should be read together
          with our{" "}
          <Link href="/privacy" className={MARKETING_PROSE_LINK}>
            Privacy notice
          </Link>
          .
        </p>

        <LegalH2 id="categories" className="scroll-mt-28">
          Cookie categories
        </LegalH2>
        <p>We group cookies into the following categories:</p>
        <LegalUL>
          <li>
            <strong>Strictly necessary</strong> — required to operate the service (for example
            security, load balancing, sign-in session, and fraud prevention). These do not require
            consent and cannot be turned off in our cookie banner.
          </li>
          <li>
            <strong>Analytics</strong> — helps us understand how the site is used. When you allow
            this category, we may load <strong>Google Tag Manager (GTM)</strong> and measurement
            tags such as <strong>Google Analytics 4</strong> (for example property id{" "}
            <code>G-GDG4D2YELR</code> as configured in our GTM container). These tools may set their
            own cookies or storage on your device.
          </li>
          <li>
            <strong>Marketing</strong> — used for advertising, remarketing, or similar tags you
            configure inside GTM. This category is only available when analytics is enabled, and is
            off unless you choose to allow it.
          </li>
        </LegalUL>
        <p>
          With marketing consent, we may set the first-party <code>_lax_attr</code> cookie for up to
          90 days. It stores a versioned first-touch and last-touch campaign snapshot (such as UTM
          campaign fields and advertising click identifiers) so authenticated server-side conversion
          events can be measured. Withdrawing marketing consent removes the cookie and requests
          deletion of the linked server snapshot.
        </p>

        <LegalH2 id="third-parties" className="scroll-mt-28">
          Third-party technologies
        </LegalH2>
        <p>
          When you consent to analytics, your browser may connect to Google domains (including{" "}
          <code>googletagmanager.com</code> and Google Analytics endpoints) and our first-party
          tagging server at <code>https://gtm.lax.bid</code>, subject to Google&apos;s terms and
          privacy policy. We use <strong>Google Consent Mode</strong> so that optional tags respect
          your choices before they run.
        </p>

        <LegalH2 id="manage" className="scroll-mt-28">
          Manage your preferences
        </LegalH2>
        <p>
          You can accept optional cookies using the banner when you first visit, or open{" "}
          <strong>Cookie preferences</strong> from the site footer at any time. In the preferences
          dialog you can turn categories on or off, click <strong>Reject all</strong> to refuse
          optional cookies, or <strong>Save preferences</strong> to apply your toggle choices
          (toggles default to off). You can also clear cookies through your browser settings.
        </p>
      </LegalPage>
    </PolicyHubLayout>
  );
}
