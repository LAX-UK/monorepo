import { LegalH2, LegalPage, LegalUL } from "@/components/marketing/legal-page";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import {
  SITE_BUSINESS_ADDRESS_LINES,
  SITE_LEGAL_NAME,
  SITE_NAME,
  SITE_SUPPORT_EMAIL,
} from "@/lib/brand";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { policyHubPageJsonLd } from "@/lib/seo/jsonld";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "Privacy Notice",
  description:
    "Privacy Notice for LAX.BID by London Art Exchange and how personal data is collected, used, and protected.",
  path: "/privacy",
});

const toc = [
  { id: "information-we-collect", label: "Information we collect" },
  { id: "how-we-use-personal-data", label: "How we use data" },
  { id: "lawful-bases", label: "Lawful bases" },
  { id: "sharing", label: "Sharing data" },
  { id: "international-transfers", label: "International transfers" },
  { id: "retention", label: "How long we keep data" },
  { id: "cookies", label: "Cookies" },
  { id: "marketing-preferences", label: "Marketing preferences" },
  { id: "rights", label: "Your rights" },
  { id: "security", label: "Security" },
  { id: "children", label: "Children" },
  { id: "automated-decision-making", label: "Automated decision-making" },
  { id: "third-party-links", label: "Third-party links" },
  { id: "changes", label: "Changes to this notice" },
  { id: "contact", label: "Contact" },
] as const;

const accountData = [
  "name",
  "email address",
  "telephone number",
  "billing address",
  "delivery address",
  "account login details",
  "user ID and account preferences",
  "communication preferences",
  "identity verification information, where required",
] as const;

const transactionData = [
  "auction registration details",
  "bidding history",
  "watchlist activity",
  "lots viewed or followed",
  "invoices",
  "payment status",
  "buyer’s premium, VAT, shipping, and settlement records",
  "purchase history",
  "consignment history",
  "seller settlement details",
  "correspondence relating to bids, purchases, consignments, disputes, or after-sale support",
] as const;

const sellerData = [
  "ownership information",
  "provenance documents",
  "certificates of authenticity",
  "purchase invoices",
  "artist, gallery, studio, publisher, foundry, or estate correspondence",
  "import/export documents",
  "condition records",
  "valuation and reserve information",
  "banking or settlement details",
  "information required to verify your authority to sell",
] as const;

const complianceData = [
  "proof of identity",
  "proof of address",
  "company details",
  "beneficial ownership information",
  "source-of-funds information",
  "source-of-wealth information",
  "sanctions screening results",
  "fraud-prevention checks",
  "payment-risk indicators",
  "anti-money laundering records",
] as const;

const technicalData = [
  "IP address",
  "device type",
  "browser type",
  "operating system",
  "session data",
  "pages visited",
  "referral source",
  "approximate location derived from technical data",
  "security logs",
  "cookie identifiers",
  "analytics data",
] as const;

const marketingData = [
  "newsletter subscriptions",
  "auction alert preferences",
  "email engagement data",
  "enquiries submitted through forms",
  "customer service communications",
  "survey or feedback responses",
] as const;

const platformUses = [
  "create and manage user accounts",
  "authenticate users",
  "maintain account security",
  "process registrations",
  "administer auctions",
  "record bids",
  "manage watchlists",
  "process purchases",
  "issue invoices",
  "support private sales and post-auction sales",
  "arrange collection, shipping, storage, and documentation",
] as const;

const transactionUses = [
  "process bids and purchases",
  "verify buyer and seller details",
  "manage payments and settlement",
  "calculate buyer’s premium, VAT, shipping, and other charges",
  "confirm consignment arrangements",
  "manage reserve prices and seller instructions",
  "process refunds, cancellations, disputes, or chargebacks where applicable",
  "maintain transaction records",
] as const;

const complianceUses = [
  "verify identity",
  "conduct anti-money laundering checks",
  "screen for sanctions and fraud risks",
  "assess payment and chargeback risk",
  "verify ownership and authority to sell",
  "detect suspicious, fraudulent, collusive, or unauthorised activity",
  "comply with legal, regulatory, tax, accounting, and reporting obligations",
] as const;

const communicationUses = [
  "respond to enquiries",
  "send account notifications",
  "send auction registration updates",
  "send bid, invoice, payment, collection, shipping, and settlement notifications",
  "provide customer support",
  "send important legal, operational, or security notices",
] as const;

const improvementUses = [
  "monitor website performance",
  "understand how users interact with the platform",
  "improve navigation, search, catalogue presentation, and account functionality",
  "maintain cybersecurity",
  "test and improve platform features",
  "generate aggregated and anonymised analytics",
] as const;

const marketingUses = [
  "auction alerts",
  "catalogue releases",
  "event invitations",
  "editorial updates",
  "platform announcements",
  "selected marketing communications relating to LAX.BID and its associated services",
] as const;

const legitimateInterests = [
  "operating a secure auction platform",
  "preventing fraud and misuse",
  "verifying bidders and sellers",
  "protecting buyers, sellers, and LAX.BID",
  "managing disputes and legal claims",
  "improving the platform",
  "maintaining business records",
  "protecting the integrity of auction processes",
  "conducting proportionate direct marketing to existing clients or users, where permitted",
] as const;

const recipients = [
  "payment processors, including Stripe",
  "banking and settlement providers",
  "identity verification and anti-money laundering providers",
  "fraud-prevention and sanctions-screening providers",
  "shipping, logistics, storage, and insurance providers",
  "IT hosting, cloud, security, analytics, and platform-service providers",
  "professional advisers, including lawyers, accountants, auditors, insurers, and tax advisers",
  "auction technology providers",
  "buyers, sellers, agents, or representatives where necessary to complete a transaction",
  "law enforcement, regulators, courts, tax authorities, or government bodies where required or permitted by law",
] as const;

const rights = [
  "request access to your personal data",
  "request correction of inaccurate or incomplete data",
  "request deletion of your personal data",
  "request restriction of processing",
  "object to processing based on legitimate interests",
  "object to direct marketing",
  "request transfer of your data in a portable format",
  "withdraw consent where processing is based on consent",
  "lodge a complaint with the Information Commissioner’s Office",
] as const;

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <LegalUL>
      {items.map((item) => (
        <li key={item}>{item}.</li>
      ))}
    </LegalUL>
  );
}

export default function PrivacyPage() {
  return (
    <PolicyHubLayout>
      <script type="application/ld+json" suppressHydrationWarning>
        {policyHubPageJsonLd({
          path: "/privacy",
          breadcrumbName: "Privacy Notice",
          pageName: "Privacy notice",
          description:
            "Privacy Notice for LAX.BID by London Art Exchange and how personal data is collected, used, and protected.",
        })}
      </script>
      <LegalPage
        title="Privacy notice"
        toc={[...toc]}
        lastUpdated="21 April 2026"
        kicker={null}
        dividerUnderDate
        embedded
      >
        <p>
          This Privacy Notice explains how {SITE_LEGAL_NAME}, trading as {SITE_NAME}, collects,
          uses, stores, shares, and protects personal data when you use our website, register for an
          account, bid in an auction, consign property, purchase or sell a lot, contact us,
          subscribe to communications, or otherwise interact with our platform.
        </p>
        <p>
          {SITE_NAME} is a curated auction and private sale platform specialising in fine art,
          collectibles, cultural property, and select luxury assets. We process personal data to
          operate the platform, manage auctions and transactions, comply with legal obligations,
          prevent fraud, support buyers and sellers, and provide a secure and professional auction
          experience.
        </p>
        <p>For the purposes of UK data protection law, the data controller is:</p>
        <address className="not-italic">
          {SITE_BUSINESS_ADDRESS_LINES.map((line) => (
            <span key={line}>
              {line}
              <br />
            </span>
          ))}
        </address>
        <p>
          For privacy enquiries, please contact{" "}
          <a href={`mailto:${SITE_SUPPORT_EMAIL}`} className={MARKETING_PROSE_LINK}>
            {SITE_SUPPORT_EMAIL}
          </a>
          .
        </p>

        <LegalH2 id="information-we-collect" className="scroll-mt-28">
          1. Information We Collect
        </LegalH2>
        <p>We may collect and process the following categories of personal data.</p>
        <p>Account and identity information may include:</p>
        <BulletList items={accountData} />
        <p>Bidding and transaction information may include:</p>
        <BulletList items={transactionData} />
        <p>Where you submit or consign property, seller and consignment information may include:</p>
        <BulletList items={sellerData} />
        <p>For certain transactions, compliance and verification information may include:</p>
        <BulletList items={complianceData} />
        <p>
          Payments may be processed by third-party payment providers, including Stripe and banking
          partners. {SITE_NAME} does not store full card numbers or full banking credentials on its
          own servers. Payment providers may process payment data in accordance with their own
          security and compliance obligations.
        </p>
        <p>Technical and usage information may include:</p>
        <BulletList items={technicalData} />
        <p>Marketing and communications information may include:</p>
        <BulletList items={marketingData} />

        <LegalH2 id="how-we-use-personal-data" className="scroll-mt-28">
          2. How We Use Personal Data
        </LegalH2>
        <p>We use personal data for the following purposes.</p>
        <p>To provide and operate the platform, we use data to:</p>
        <BulletList items={platformUses} />
        <p>To manage buyer and seller transactions, we use data to:</p>
        <BulletList items={transactionUses} />
        <p>To carry out compliance, fraud prevention and risk checks, we use data to:</p>
        <BulletList items={complianceUses} />
        <p>To communicate with you, we use data to:</p>
        <BulletList items={communicationUses} />
        <p>To improve the platform, we use data to:</p>
        <BulletList items={improvementUses} />
        <p>Where permitted, we may use your data to send:</p>
        <BulletList items={marketingUses} />
        <p>
          You can opt out of marketing communications at any time by using the unsubscribe link in
          our emails or by updating your account preferences. Transactional, legal, security,
          invoice, account, and auction-service messages are not marketing communications and may
          still be sent where necessary.
        </p>

        <LegalH2 id="lawful-bases" className="scroll-mt-28">
          3. Lawful Bases for Processing
        </LegalH2>
        <p>We only process personal data where we have a lawful basis to do so.</p>
        <p>
          We rely on performance of a contract where necessary to register users, administer
          accounts, manage bids, complete purchases, process consignments, issue invoices, arrange
          delivery, settle sellers, and provide services requested by buyers or sellers.
        </p>
        <p>
          We rely on legal obligation where necessary to comply with legal, regulatory, accounting,
          tax, anti-money laundering, sanctions, fraud-prevention, record-keeping, and reporting
          obligations.
        </p>
        <p>
          We rely on legitimate interests where necessary for our legitimate business interests,
          provided those interests are not overridden by your rights and freedoms. These interests
          may include:
        </p>
        <BulletList items={legitimateInterests} />
        <p>
          We rely on consent where required, including for certain optional cookies, certain
          marketing preferences, and any other processing where consent is legally required. You may
          withdraw consent at any time where processing is based on consent.
        </p>

        <LegalH2 id="sharing" className="scroll-mt-28">
          4. Who We Share Personal Data With
        </LegalH2>
        <p>
          We may share personal data with selected third parties where necessary to operate the
          platform, complete transactions, comply with law, or protect legitimate business
          interests. These may include:
        </p>
        <BulletList items={recipients} />
        <p>
          We only share personal data where there is a proper reason to do so and, where required,
          appropriate contractual protections are in place.
        </p>

        <LegalH2 id="international-transfers" className="scroll-mt-28">
          5. International Transfers
        </LegalH2>
        <p>
          Some service providers may process personal data outside the United Kingdom. Where
          personal data is transferred internationally, we take steps designed to ensure appropriate
          protection is in place. This may include using adequacy regulations, approved contractual
          safeguards, or other lawful transfer mechanisms recognised under UK data protection law.
        </p>

        <LegalH2 id="retention" className="scroll-mt-28">
          6. How Long We Keep Personal Data
        </LegalH2>
        <p>
          We keep personal data only for as long as necessary for the purposes for which it was
          collected, including legal, accounting, tax, compliance, fraud-prevention,
          dispute-resolution, and record-keeping purposes.
        </p>
        <p>As a general guide:</p>
        <LegalUL>
          <li>
            account data is retained while the account remains active and for a reasonable period
            afterwards;
          </li>
          <li>
            auction, transaction, invoice, purchase, consignment, settlement, and payment records
            may be retained for legal, tax, accounting, audit, and dispute purposes;
          </li>
          <li>
            compliance, AML, sanctions, identity-verification, and fraud-prevention records may be
            retained where required or appropriate under applicable law;
          </li>
          <li>
            marketing data is retained until you unsubscribe or update your preferences, subject to
            suppression records being retained to respect opt-out choices;
          </li>
          <li>
            technical and analytics data is retained for a limited period unless anonymised or
            required for security, fraud-prevention, or legal purposes.
          </li>
        </LegalUL>

        <LegalH2 id="cookies" className="scroll-mt-28">
          7. Cookies and Similar Technologies
        </LegalH2>
        <p>
          We use cookies and similar technologies to operate the website, keep users signed in,
          remember preferences, protect against fraud, analyse platform performance, and improve the
          user experience.
        </p>
        <p>
          Some cookies are essential for the site to function. Optional analytics or marketing
          cookies are used only where permitted and, where required, with consent. Our{" "}
          <code>lax_consent</code> cookie records those choices. When marketing is allowed,{" "}
          <code>_lax_attr</code> stores a first/last campaign snapshot for up to 90 days; it is
          removed and its linked server snapshot is deleted when marketing consent is withdrawn.
        </p>
        <p>
          On the public marketing site and buyer dashboard, optional analytics may be loaded via{" "}
          <strong>Google Tag Manager</strong> (container <code>GTM-W6K4N67Z</code>) when you choose
          to allow analytics cookies. Browser data is sent through our first-party tagging server at{" "}
          <code>https://gtm.lax.bid</code> (server-side GTM container <code>GTM-575HV8LQ</code>).
          Measurement (for example <strong>Google Analytics 4</strong> property{" "}
          <code>G-GDG4D2YELR</code>) is configured inside that stack. When you allow{" "}
          <strong>marketing</strong> cookies, we may also use <strong>Meta Pixel</strong> and the{" "}
          <strong>Meta Conversions API</strong> (hashed email/name and identifiers such as{" "}
          <code>_fbp</code> / <code>_fbc</code>) for ad measurement and deduplication. Server-side
          conversion events (for example payment confirmation) may be sent under documented
          legitimate interest when no new marketing cookies are read for that event. We use{" "}
          <strong>Google Consent Mode</strong> so tags respect your choices. Authentication uses
          first-party session cookies; error monitoring may use Sentry in accordance with our
          subprocessors list.
        </p>
        <p>
          You can manage cookie preferences through the in-site banner and{" "}
          <Link href="/cookies" className={MARKETING_PROSE_LINK}>
            Cookie policy
          </Link>
          , through the <strong>Cookie preferences</strong> link in the site footer, through your
          browser settings, and through dashboard preferences where applicable.
        </p>

        <LegalH2 id="marketing-preferences" className="scroll-mt-28">
          8. Marketing Preferences
        </LegalH2>
        <p>
          We may send marketing communications where you have opted in or where we are otherwise
          permitted to do so under applicable law. You can opt out of marketing at any time by
          clicking the unsubscribe link in our emails, updating your account or dashboard
          preferences, or contacting us at{" "}
          <a href={`mailto:${SITE_SUPPORT_EMAIL}`} className={MARKETING_PROSE_LINK}>
            {SITE_SUPPORT_EMAIL}
          </a>
          .
        </p>
        <p>
          Opting out of marketing will not prevent us from sending important service communications,
          including messages relating to your account, bids, purchases, invoices, consignments,
          payments, compliance checks, shipping, settlement, security, or legal notices.
        </p>

        <LegalH2 id="rights" className="scroll-mt-28">
          9. Your Data Protection Rights
        </LegalH2>
        <p>Subject to applicable law and certain exemptions, you may have the right to:</p>
        <BulletList items={rights} />
        <p>
          These rights are not always absolute. For example, we may need to retain certain records
          for legal, tax, accounting, AML, fraud-prevention, dispute, or transaction-integrity
          reasons.
        </p>
        <p>
          To exercise your rights, please contact{" "}
          <a href={`mailto:${SITE_SUPPORT_EMAIL}`} className={MARKETING_PROSE_LINK}>
            {SITE_SUPPORT_EMAIL}
          </a>
          . We may need to verify your identity before responding to a rights request.
        </p>

        <LegalH2 id="security" className="scroll-mt-28">
          10. Security
        </LegalH2>
        <p>
          We use technical and organisational measures designed to protect personal data against
          unauthorised access, loss, misuse, alteration, disclosure, or destruction. These measures
          may include access controls, encryption, secure hosting, authentication controls, audit
          logs, staff access limitations, and third-party security safeguards.
        </p>
        <p>
          No online platform can guarantee absolute security, but we take reasonable steps to
          protect personal data and maintain platform integrity.
        </p>

        <LegalH2 id="children" className="scroll-mt-28">
          11. Children
        </LegalH2>
        <p>
          {SITE_NAME} is not intended for children. Users must be at least 18 years old to register,
          bid, buy, consign, or sell through the platform. We do not knowingly collect personal data
          from children.
        </p>

        <LegalH2 id="automated-decision-making" className="scroll-mt-28">
          12. Automated Decision-Making
        </LegalH2>
        <p>
          We may use automated tools to support fraud prevention, sanctions screening, payment-risk
          assessment, account security, platform analytics, or compliance workflows. We do not use
          solely automated decision-making that produces legal or similarly significant effects on
          individuals without appropriate human involvement, unless permitted by law.
        </p>

        <LegalH2 id="third-party-links" className="scroll-mt-28">
          13. Links to Third-Party Websites
        </LegalH2>
        <p>
          The platform may contain links to third-party websites, including payment processors,
          shipping providers, authentication services, or partner platforms. We are not responsible
          for the privacy practices, security, or content of third-party websites. You should review
          their privacy notices before providing personal data to them.
        </p>

        <LegalH2 id="changes" className="scroll-mt-28">
          14. Changes to This Privacy Notice
        </LegalH2>
        <p>
          We may update this Privacy Notice from time to time. The latest version will be published
          on this page with the Last updated date. Where changes are material, we may take
          additional steps to notify users.
        </p>

        <LegalH2 id="contact" className="scroll-mt-28">
          15. Contact and Complaints
        </LegalH2>
        <p>
          For privacy, data protection, or account-data enquiries, please contact{" "}
          <a href={`mailto:${SITE_SUPPORT_EMAIL}`} className={MARKETING_PROSE_LINK}>
            {SITE_SUPPORT_EMAIL}
          </a>
          .
        </p>
        <p>
          For complaints, please contact{" "}
          <a href="mailto:complaints@lax.bid" className={MARKETING_PROSE_LINK}>
            complaints@lax.bid
          </a>
          .
        </p>
        <p>Postal address:</p>
        <address className="not-italic">
          {SITE_BUSINESS_ADDRESS_LINES.map((line) => (
            <span key={line}>
              {line}
              <br />
            </span>
          ))}
        </address>
        <p>
          You also have the right to complain to the UK Information Commissioner&apos;s Office if
          you are unhappy with how your personal data has been handled.
        </p>
      </LegalPage>
    </PolicyHubLayout>
  );
}
