import { LegalPage } from "@/components/marketing/legal-page";
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
  { id: "conduct", label: "Conduct" },
  { id: "legal", label: "Legal" },
] as const;

export default function TermsPage() {
  return (
    <LegalPage title="Terms of sale" toc={[...toc]} lastUpdated="21 April 2026">
      <h2 id="binding-bids" className="scroll-mt-28 font-headline text-2xl text-on-surface">
        Binding bids
      </h2>
      <p>
        By registering to bid, you agree to honor all winning bids as binding purchase commitments,
        subject to reserve and auction rules published for each lot. Buyer&apos;s premium, taxes,
        and shipping are additional unless stated otherwise on the invoice.
      </p>
      <h2 id="fees" className="scroll-mt-28 font-headline text-2xl text-on-surface">
        Fees & settlement
      </h2>
      <p>
        Invoices are issued in GBP unless a lot states otherwise. Payment windows and accepted
        methods appear on the invoice and in your dashboard.
      </p>
      <h2 id="conduct" className="scroll-mt-28 font-headline text-2xl text-on-surface">
        Conduct
      </h2>
      <p>
        We may refuse service or cancel bids that appear fraudulent, collusive, or in violation of
        applicable law. Nothing on this site constitutes investment or legal advice.
      </p>
      <h2 id="legal" className="scroll-mt-28 font-headline text-2xl text-on-surface">
        Legal
      </h2>
      <p>
        See our{" "}
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
  );
}
