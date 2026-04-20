import { LegalPage } from "@/components/marketing/legal-page";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "Legal",
  description:
    "Terms of sale, privacy, shipping, and key policies for LAX London Auction House Ltd.",
  path: "/legal",
});

export default function LegalHubPage() {
  return (
    <LegalPage title="Legal">
      <p>Key policies for collectors using LAX London Auction House Ltd.</p>
      <ul className="list-inside list-disc space-y-3 text-on-surface">
        <li>
          <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
            Terms of sale
          </Link>
        </li>
        <li>
          <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
            Privacy
          </Link>
        </li>
        <li>
          <Link href="/shipping" className="text-primary underline-offset-4 hover:underline">
            Shipping
          </Link>
        </li>
      </ul>
    </LegalPage>
  );
}
