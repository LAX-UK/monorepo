import { LegalPage } from "@/components/marketing/legal-page";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForStatic({
  title: "Shipping & logistics",
  description:
    "Shipping, insurance, and logistics information for lots purchased through LAX auctions.",
  path: "/shipping",
});

export default function ShippingPage() {
  return (
    <LegalPage title="Shipping & logistics">
      <p>
        Domestic and international shipments are quoted after the hammer falls. Fine art lots are
        packed by specialist handlers with condition reporting and insured transit where available.
      </p>
      <p>
        Import duties, taxes, and customs delays are the responsibility of the buyer unless a lot is
        explicitly offered as duty-paid. White-glove delivery can be arranged in major markets.
      </p>
    </LegalPage>
  );
}
