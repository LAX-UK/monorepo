import { LegalPage } from "@/components/marketing/legal-page";
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
] as const;

export default function PrivacyPage() {
  return (
    <PolicyHubLayout>
      <LegalPage title="Privacy notice" toc={[...toc]} lastUpdated="21 April 2026" embedded>
        <h2 id="collection" className="scroll-mt-28 font-headline text-2xl text-on-surface">
          What we collect
        </h2>
        <p>
          We collect account and session data necessary to operate auctions, process settlements,
          and comply with legal obligations. Payment details are handled by our payment partners; we
          do not store full card numbers on our servers.
        </p>
        <h2 id="use" className="scroll-mt-28 font-headline text-2xl text-on-surface">
          How we use data
        </h2>
        <p>
          Data is used to authenticate you, fulfil orders, prevent fraud, and improve the platform.
          Analytics are aggregated where possible.
        </p>
        <h2 id="rights" className="scroll-mt-28 font-headline text-2xl text-on-surface">
          Your rights
        </h2>
        <p>
          You may request access or deletion of personal data where applicable law allows. Marketing
          communications are opt-in and can be withdrawn at any time. DPA contact:{" "}
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
      </LegalPage>
    </PolicyHubLayout>
  );
}
