import { LegalPage } from "@/components/marketing/legal-page";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import { policyHubPageJsonLd } from "@/lib/seo/jsonld";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "Legal",
  description:
    "Conditions of Business, Privacy Notice, Shipping & Logistics, and key policies for LAX.BID by London Art Exchange.",
  path: "/legal",
});

export default function LegalHubPage() {
  return (
    <PolicyHubLayout>
      <script type="application/ld+json" suppressHydrationWarning>
        {policyHubPageJsonLd({
          path: "/legal",
          breadcrumbName: "Legal",
          pageName: "Legal",
          description:
            "Conditions of Business, Privacy Notice, Shipping & Logistics, and key policies for LAX.BID by London Art Exchange.",
        })}
      </script>
      <LegalPage title="Legal" lastUpdated="21 April 2026" kicker={null} dividerUnderDate embedded>
        <p>Key policies for collectors using LAX.BID by London Art Exchange.</p>
        <ul className="list-inside list-disc space-y-3 text-on-surface">
          <li>
            <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
              Conditions of Business
            </Link>
          </li>
          <li>
            <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
              Privacy Notice
            </Link>
          </li>
          <li>
            <Link href="/shipping" className="text-primary underline-offset-4 hover:underline">
              Shipping &amp; Logistics
            </Link>
          </li>
        </ul>
      </LegalPage>
    </PolicyHubLayout>
  );
}
