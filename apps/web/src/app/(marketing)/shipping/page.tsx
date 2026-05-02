import { LegalPage } from "@/components/marketing/legal-page";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
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
    <PolicyHubLayout>
      <LegalPage title="Shipping & logistics" lastUpdated="21 April 2026" embedded>
        <p>
          Domestic and international shipments are quoted after the hammer falls. Fine art lots are
          packed by specialist handlers with condition reporting and insured transit where
          available.
        </p>
        <h2 id="zones" className="scroll-mt-28 font-headline text-2xl text-on-surface">
          Zones &amp; typical lead times
        </h2>
        <div className="overflow-x-auto rounded-lg border border-outline-variant/30">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-surface-container-low font-label text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant">
              <tr>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">Standard</th>
                <th className="px-4 py-3">Museum / white-glove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              <tr>
                <td className="px-4 py-3">UK domestic</td>
                <td className="px-4 py-3">5–10 business days</td>
                <td className="px-4 py-3">10–20 business days</td>
              </tr>
              <tr>
                <td className="px-4 py-3">EU</td>
                <td className="px-4 py-3">10–15 business days</td>
                <td className="px-4 py-3">15–25 business days</td>
              </tr>
              <tr>
                <td className="px-4 py-3">North America</td>
                <td className="px-4 py-3">12–18 business days</td>
                <td className="px-4 py-3">18–30 business days</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-on-surface-variant">
          Timelines exclude customs holds. Final quotes include packing tier, insured value, and
          carrier surcharges.
        </p>
        <h2 id="export" className="scroll-mt-28 font-headline text-2xl text-on-surface">
          Export &amp; customs
        </h2>
        <p>
          Import duties, taxes, and customs delays are the responsibility of the buyer unless a lot
          is explicitly offered as duty-paid. We provide commercial invoices and provenance packs
          where available to support clearance.
        </p>
        <h2 id="insurance" className="scroll-mt-28 font-headline text-2xl text-on-surface">
          Insurance
        </h2>
        <p>
          Shipments are insured door-to-door at hammer + buyer&apos;s premium unless you opt out in
          writing (not recommended for fine art). Claims must be reported within 48 hours of
          receipt.
        </p>
      </LegalPage>
    </PolicyHubLayout>
  );
}
