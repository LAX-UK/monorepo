import { LegalH2, LegalPage, LegalUL } from "@/components/marketing/legal-page";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import {
  SITE_BUSINESS_ADDRESS_LINES,
  SITE_CONTACT_EMAIL,
  SITE_SUPPORT_EMAIL,
  SITE_TELEPHONE_DISPLAY,
  SITE_TELEPHONE_HREF,
} from "@/lib/brand";
import { policyHubPageJsonLd } from "@/lib/seo/jsonld";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForStatic({
  title: "Shipping & Logistics",
  description:
    "Shipping, collection, insurance, and logistics information for lots purchased through LAX.BID by London Art Exchange.",
  path: "/shipping",
});

export default function ShippingPage() {
  return (
    <PolicyHubLayout>
      <script type="application/ld+json" suppressHydrationWarning>
        {policyHubPageJsonLd({
          path: "/shipping",
          breadcrumbName: "Shipping & Logistics",
          pageName: "Shipping & Logistics",
          description:
            "Shipping, collection, insurance, and logistics information for lots purchased through LAX.BID by London Art Exchange.",
        })}
      </script>
      <LegalPage
        title="Shipping & Logistics"
        lastUpdated="21 April 2026"
        kicker={null}
        dividerUnderDate
        embedded
      >
        <LegalH2>Overview</LegalH2>
        <p>
          LAX.BID coordinates domestic and international shipping for purchased lots through
          specialist logistics providers experienced in the handling of fine art, editions,
          collectibles, and high-value objects.
        </p>
        <p>
          Following the close of an auction, shipping quotations are prepared once the buyer&apos;s
          invoice has been issued and the relevant delivery details have been confirmed. All
          shipping arrangements are subject to the nature, size, value, condition, and destination
          of the lot.
        </p>
        <p>
          Where appropriate, works are packed by specialist handlers using materials and methods
          suitable for the category of item being transported.
        </p>

        <LegalH2>Shipping Quotes</LegalH2>
        <p>
          Shipping costs are not included in the hammer price or buyer&apos;s premium unless
          expressly stated.
        </p>
        <p>
          Following a successful purchase, the buyer may request a shipping quotation through the
          LAX.BID team. Final quotes may include packing, handling, insurance, carrier charges,
          customs documentation, and any applicable administrative or third-party costs.
        </p>
        <p>
          Buyers are also permitted to arrange their own collection or shipping provider, subject to
          prior approval and appointment.
        </p>

        <LegalH2 id="zones" className="scroll-mt-28">
          Typical Lead Times
        </LegalH2>
        <p>
          The following timeframes are indicative only and may vary depending on packing
          requirements, customs processing, carrier availability, and the destination of the lot.
        </p>
        <div className="overflow-x-auto rounded-sm border border-divider-soft">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-surface-container-low font-label text-[0.65rem] font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
              <tr>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">Standard Shipping</th>
                <th className="px-4 py-3">Specialist / White-Glove Handling</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider-soft">
              <tr>
                <td className="px-4 py-3">UK Domestic</td>
                <td className="px-4 py-3">5–10 business days</td>
                <td className="px-4 py-3">10–20 business days</td>
              </tr>
              <tr>
                <td className="px-4 py-3">European Union</td>
                <td className="px-4 py-3">10–15 business days</td>
                <td className="px-4 py-3">15–25 business days</td>
              </tr>
              <tr>
                <td className="px-4 py-3">North America</td>
                <td className="px-4 py-3">12–18 business days</td>
                <td className="px-4 py-3">18–30 business days</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Asia Pacific</td>
                <td className="px-4 py-3">14–21 business days</td>
                <td className="px-4 py-3">21–35 business days</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-on-surface-variant">
          Timelines begin only once full cleared payment has been received and delivery arrangements
          have been confirmed.
        </p>

        <LegalH2>Packing &amp; Handling</LegalH2>
        <p>
          Lots are packed according to their category, medium, size, fragility, and destination.
        </p>
        <p>
          Where required, LAX.BID may coordinate specialist packing, soft wrapping, framed-work
          protection, crate preparation, or white-glove handling. Packing methods are determined on
          a case-by-case basis and may be reflected in the final shipping quotation.
        </p>
        <p>For high-value or delicate works, specialist handling may be required before release.</p>

        <LegalH2 id="insurance" className="scroll-mt-28">
          Insurance
        </LegalH2>
        <p>
          Where available, shipments may be insured in transit at the buyer&apos;s expense.
          Insurance values are generally based on the hammer price plus buyer&apos;s premium, unless
          otherwise agreed in writing.
        </p>
        <p>
          Buyers who choose to arrange their own shipping are responsible for ensuring that adequate
          insurance is in place from the point of collection.
        </p>
        <p>
          Any claim relating to loss or damage in transit must be reported promptly and supported by
          relevant photographs, packaging evidence, and delivery documentation.
        </p>

        <LegalH2 id="export" className="scroll-mt-28">
          Export &amp; customs
        </LegalH2>
        <p>
          For international shipments, import duties, taxes, customs charges, and clearance
          requirements are the responsibility of the buyer unless expressly stated otherwise.
        </p>
        <p>
          LAX.BID may assist by providing relevant commercial invoices and available supporting
          documentation. However, buyers are responsible for ensuring that the lot may be lawfully
          imported into the destination country.
        </p>
        <p>Customs delays are outside the control of LAX.BID and may affect delivery timelines.</p>

        <LegalH2 id="collection" className="scroll-mt-28">
          Collection in Person
        </LegalH2>
        <p>Collection may be arranged by appointment following receipt of full cleared payment.</p>
        <p>
          Buyers collecting in person may be required to provide photographic identification
          matching the registered bidder account. Where a third party is collecting on behalf of the
          buyer, written authorisation must be provided in advance.
        </p>
        <p>Collections are available by appointment from:</p>
        <address className="not-italic">
          {SITE_BUSINESS_ADDRESS_LINES.map((line) => (
            <span key={line}>
              {line}
              <br />
            </span>
          ))}
        </address>

        <LegalH2>Release of Lots</LegalH2>
        <p>
          No lot will be released until full cleared payment has been received and any required
          verification, documentation, or collection arrangements have been completed.
        </p>
        <p>
          LAX.BID reserves the right to withhold release where payment, identity, ownership,
          compliance, or shipping details remain incomplete.
        </p>

        <LegalH2>Storage</LegalH2>
        <p>
          Purchased lots should be collected or shipped within the timeframe stated by LAX.BID
          following payment.
        </p>
        <p>
          Where lots remain uncollected for an extended period, storage charges may apply. Any
          applicable storage arrangements or charges will be communicated to the buyer in advance
          where possible.
        </p>

        <LegalH2>Support</LegalH2>
        <LegalUL>
          <li>
            For shipping, collection, or logistics enquiries, please contact{" "}
            <a
              href={`mailto:${SITE_SUPPORT_EMAIL}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {SITE_SUPPORT_EMAIL}
            </a>
            .
          </li>
          <li>
            For general enquiries, contact{" "}
            <a
              href={`mailto:${SITE_CONTACT_EMAIL}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {SITE_CONTACT_EMAIL}
            </a>
            .
          </li>
          <li>
            Telephone:{" "}
            <a
              href={`tel:${SITE_TELEPHONE_HREF}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {SITE_TELEPHONE_DISPLAY}
            </a>
            .
          </li>
        </LegalUL>
      </LegalPage>
    </PolicyHubLayout>
  );
}
