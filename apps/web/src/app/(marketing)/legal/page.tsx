import { LegalPage, LegalUL } from "@/components/marketing/legal-page";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import { legalPolicyRoutes, policyRouteLabel } from "@/components/marketing/policy-routes";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { policyHubPageJsonLd } from "@/lib/seo/jsonld";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import Link from "next/link";

const policyIndex = legalPolicyRoutes.map((route) => ({
  href: route.href,
  label: policyRouteLabel(route),
}));

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
        <LegalUL>
          {policyIndex.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={MARKETING_PROSE_LINK}>
                {item.label}
              </Link>
            </li>
          ))}
        </LegalUL>
      </LegalPage>
    </PolicyHubLayout>
  );
}
