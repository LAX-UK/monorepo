import { LegalH2, LegalPage, LegalUL } from "@/components/marketing/legal-page";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "Privacy",
  description:
    "Privacy notice for LAX London Auction House Ltd — how we collect, use, and protect your data.",
  path: "/privacy",
});

const toc = [
  { id: "collection", label: "What we collect" },
  { id: "use", label: "How we use data" },
  { id: "rights", label: "Your rights" },
  { id: "cookies", label: "Cookies" },
] as const;

export default function PrivacyPage() {
  return (
    <PolicyHubLayout>
      <LegalPage
        title="Privacy notice"
        toc={[...toc]}
        lastUpdated="21 April 2026"
        kicker={null}
        dividerUnderDate
        embedded
      >
        <LegalH2 id="collection" className="scroll-mt-28">
          What we collect
        </LegalH2>
        <p>
          We collect the account and session data we need to operate auctions, process settlements,
          and meet our legal obligations. This includes your name, email, billing address, and your
          bidding history.
        </p>
        <p>
          Payment details are handled by our payment partners (Stripe and our settlement bank). Full
          card numbers and bank credentials are never stored on our servers.
        </p>

        <LegalH2 id="use" className="scroll-mt-28">
          How we use data
        </LegalH2>
        <p>Data is used to:</p>
        <LegalUL>
          <li>Authenticate you and keep your account secure.</li>
          <li>Fulfil purchases, payments, shipping, and settlement.</li>
          <li>Detect and prevent fraud or unauthorised bidding.</li>
          <li>Improve the platform via aggregated, anonymised analytics.</li>
          <li>Send you transactional notifications and (opt-in) catalogue alerts.</li>
        </LegalUL>

        <LegalH2 id="rights" className="scroll-mt-28">
          Your rights
        </LegalH2>
        <p>
          You may request access, correction, or deletion of your personal data where applicable law
          allows. Marketing communications are opt-in and can be withdrawn from your{" "}
          <Link
            href="/dashboard/settings"
            className="text-primary underline-offset-4 hover:underline"
          >
            dashboard
          </Link>{" "}
          at any time.
        </p>
        <p>
          For data protection enquiries, our DPA contact is{" "}
          <a
            href="mailto:concierge@laxauction.house"
            className="text-primary underline-offset-4 hover:underline"
          >
            concierge@laxauction.house
          </a>
          . See also our{" "}
          <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
            Terms of sale
          </Link>
          .
        </p>

        <LegalH2 id="cookies" className="scroll-mt-28">
          Cookies
        </LegalH2>
        <p>
          We use a small number of essential cookies to keep you signed in, remember display
          preferences, and protect against fraud. Optional analytics cookies are set only with your
          consent and can be revoked at any time from your dashboard preferences.
        </p>
      </LegalPage>
    </PolicyHubLayout>
  );
}
