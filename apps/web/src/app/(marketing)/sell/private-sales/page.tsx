import { PrivateSalesPage } from "@/components/private-sales/private-sales-page";
import { PRIVATE_SALES_PATH } from "@/lib/marketing/private-sales";
import { isEnquiryPath } from "@/lib/private-sales/enquiry-values";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForStatic({
  title: "Private sales",
  description:
    "Buy or sell a work privately, outside the auction calendar. A specialist handles every enquiry in confidence.",
  path: PRIVATE_SALES_PATH,
});

export default async function PrivateSalesRoute({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  const { path } = await searchParams;
  const jsonLdText = jsonLdScript(
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Selling with LAX.BID", path: "/sell" },
      { name: "Private sales", path: PRIVATE_SALES_PATH },
    ]),
  );
  return (
    <>
      <script type="application/ld+json" suppressHydrationWarning>
        {jsonLdText}
      </script>
      <PrivateSalesPage initialPath={isEnquiryPath(path) ? path : "sell"} />
    </>
  );
}
