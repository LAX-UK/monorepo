import { LegalPage } from "@/components/marketing/legal-page";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForStatic({
  title: "Privacy",
  description:
    "Privacy notice for LAX London Auction House Ltd — how we collect, use, and protect your data.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy">
      <p>
        We collect account and session data necessary to operate auctions, process settlements, and
        comply with legal obligations. Payment details are handled by our payment partners; we do
        not store full card numbers on our servers.
      </p>
      <p>
        You may request access or deletion of personal data where applicable law allows. Marketing
        communications are opt-in and can be withdrawn at any time.
      </p>
    </LegalPage>
  );
}
