import { LegalPage } from "@/components/marketing/legal-page";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "FAQs",
  description: "Frequently asked questions about bidding, shipping, and accounts at LAX.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <LegalPage title="FAQs" lastUpdated="21 April 2026">
      <h2 id="bidding" className="scroll-mt-28 font-headline text-2xl text-on-surface">
        Bidding
      </h2>
      <p>
        Register for a free account before placing bids. Hammer prices are subject to buyer&apos;s
        premium, taxes, and shipping as shown on your invoice.
      </p>
      <h2 id="shipping" className="scroll-mt-28 font-headline text-2xl text-on-surface">
        Shipping
      </h2>
      <p>
        We coordinate insured packing and export paperwork. See{" "}
        <Link href="/shipping" className="text-primary underline-offset-4 hover:underline">
          Shipping & logistics
        </Link>{" "}
        for tiers and timelines.
      </p>
      <h2 id="accounts" className="scroll-mt-28 font-headline text-2xl text-on-surface">
        Accounts
      </h2>
      <p>
        Update profile and notification preferences in your dashboard. For access issues, contact{" "}
        <a
          href="mailto:concierge@laxauction.house"
          className="text-primary underline-offset-4 hover:underline"
        >
          concierge@laxauction.house
        </a>
        .
      </p>
    </LegalPage>
  );
}
