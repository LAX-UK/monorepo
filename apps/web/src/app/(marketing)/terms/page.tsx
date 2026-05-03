import { LegalH2, LegalPage, LegalUL } from "@/components/marketing/legal-page";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "Terms of sale",
  description: "Terms of sale and bidding rules for auctions at LAX London Auction House Ltd.",
  path: "/terms",
});

const toc = [
  { id: "binding-bids", label: "Binding bids" },
  { id: "fees", label: "Fees & settlement" },
  { id: "condition", label: "Condition & provenance" },
  { id: "conduct", label: "Conduct" },
  { id: "legal", label: "Legal" },
] as const;

export default function TermsPage() {
  return (
    <PolicyHubLayout>
      <LegalPage
        title="Terms of sale"
        toc={[...toc]}
        lastUpdated="21 April 2026"
        kicker={null}
        dividerUnderDate
        embedded
      >
        <LegalH2 id="binding-bids" className="scroll-mt-28">
          Binding bids
        </LegalH2>
        <p>
          By registering to bid, you agree to honour all winning bids as binding purchase
          commitments, subject to reserve and auction rules published for each lot. Buyer&apos;s
          premium, taxes, and shipping are additional unless stated otherwise on the invoice.
        </p>

        <LegalH2 id="fees" className="scroll-mt-28">
          Fees &amp; settlement
        </LegalH2>
        <p>
          Invoices are issued in GBP unless a lot states otherwise. Payment windows and accepted
          methods appear on the invoice and in your dashboard. Late payment may incur 1.5% monthly
          interest after the seven-day window.
        </p>
        <LegalUL>
          <li>Buyer&apos;s premium: 25% up to £500,000 hammer; 20% on the balance.</li>
          <li>UK VAT is charged on the premium at the prevailing rate (currently 20%).</li>
          <li>
            Import duties and clearance fees are payable by the buyer except for duty-paid lots.
          </li>
        </LegalUL>

        <LegalH2 id="condition" className="scroll-mt-28">
          Condition &amp; provenance
        </LegalH2>
        <p>
          Catalogue descriptions are statements of opinion based on specialist examination at the
          time of cataloguing. Condition reports and provenance packs are available on request and
          should be reviewed before bidding. All lots are sold &quot;as is&quot;; warranties are
          limited to those expressly given in our authenticity guarantee.
        </p>

        <LegalH2 id="conduct" className="scroll-mt-28">
          Conduct
        </LegalH2>
        <p>
          We may refuse service or cancel bids that appear fraudulent, collusive, or in violation of
          applicable law. Nothing on this site constitutes investment or legal advice.
        </p>

        <LegalH2 id="legal" className="scroll-mt-28">
          Legal
        </LegalH2>
        <p>
          These terms are governed by the laws of England and Wales; any disputes are subject to the
          exclusive jurisdiction of the English courts. See our{" "}
          <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
            Privacy notice
          </Link>{" "}
          and{" "}
          <Link href="/legal" className="text-primary underline-offset-4 hover:underline">
            Legal hub
          </Link>{" "}
          for cookies, jurisdiction, and regulatory statements.
        </p>
      </LegalPage>
    </PolicyHubLayout>
  );
}
