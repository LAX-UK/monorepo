import { LegalPage } from "@/components/marketing/legal-page";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@auction/ui";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "FAQs",
  description: "Frequently asked questions about bidding, shipping, and accounts at LAX.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <PolicyHubLayout>
      <LegalPage title="Frequently Asked Questions" lastUpdated="21 April 2026" embedded>
        <Accordion
          type="single"
          defaultValue="bidding"
          collapsible
          className="border-t border-outline-variant/40"
        >
          <AccordionItem value="bidding" className="border-b border-outline-variant/40">
            <AccordionTrigger className="py-4 text-left font-headline text-lg font-semibold text-on-surface hover:no-underline">
              Bidding
            </AccordionTrigger>
            <AccordionContent className="text-on-surface-variant">
              Register for a free account before placing bids. Hammer prices are subject to
              buyer&apos;s premium, taxes, and shipping as shown on your invoice.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="shipping" className="border-b border-outline-variant/40">
            <AccordionTrigger className="py-4 text-left font-headline text-lg font-semibold text-on-surface hover:no-underline">
              Shipping
            </AccordionTrigger>
            <AccordionContent className="text-on-surface-variant">
              We coordinate insured packing and export paperwork. See{" "}
              <Link href="/shipping" className="text-primary underline-offset-4 hover:underline">
                Shipping & logistics
              </Link>{" "}
              for tiers and timelines.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="accounts" className="border-b border-outline-variant/40">
            <AccordionTrigger className="py-4 text-left font-headline text-lg font-semibold text-on-surface hover:no-underline">
              Accounts
            </AccordionTrigger>
            <AccordionContent className="text-on-surface-variant">
              Update profile and notification preferences in your dashboard. For access issues,
              contact{" "}
              <a
                href="mailto:concierge@laxauction.house"
                className="text-primary underline-offset-4 hover:underline"
              >
                concierge@laxauction.house
              </a>
              .
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </LegalPage>
    </PolicyHubLayout>
  );
}
