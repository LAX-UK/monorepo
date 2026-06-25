import { LegalH2, LegalPage, LegalUL } from "@/components/marketing/legal-page";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import {
  SITE_BUYERS_PREMIUM_ABOVE_THRESHOLD,
  SITE_BUYERS_PREMIUM_STANDARD,
  SITE_BUYERS_PREMIUM_THRESHOLD,
  SITE_LEGAL_NAME,
  SITE_NAME,
  SITE_UK_VAT_RATE,
} from "@/lib/brand";
import { policyHubPageJsonLd } from "@/lib/seo/jsonld";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForStatic({
  title: "Conditions of Business",
  description:
    "Conditions of Business governing auctions, private sales, bidding, and consignments on LAX.BID by London Art Exchange.",
  path: "/terms",
});

const toc = [
  { id: "interpretation", label: "Interpretation" },
  { id: "general-conditions", label: "General Conditions" },
  { id: "buyers", label: "Conditions for Buyers" },
  { id: "sellers", label: "Conditions for Sellers" },
  { id: "legal", label: "Common Legal Provisions" },
] as const;

type TermsSection = {
  id?: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  trailingParagraphs?: string[];
};

const generalSections: TermsSection[] = [
  {
    id: "general-conditions",
    title: "Part A — General Conditions",
    paragraphs: [],
  },
  {
    title: "1. Role of LAX.BID",
    paragraphs: [
      "Unless expressly agreed otherwise in writing, LAX.BID acts as agent for the seller. The contract of sale is formed directly between the seller and the buyer when a lot is sold, whether by auction, private sale, or post-auction sale.",
      "LAX.BID may facilitate registration, bidding, cataloguing, marketing, invoicing, payment collection, logistics, documentation, and after-sale administration.",
      "LAX.BID does not take title to consigned property unless expressly stated in writing.",
      "Where a Lot is offered as our own property, or where we have an ownership or financial interest in a Lot (for example Lots marked accordingly in the catalogue), we sell as principal and not as agent. In those cases the contract of sale is between us and the Buyer, and a Consumer Buyer’s statutory rights apply against us as seller.",
    ],
  },
  {
    title: "2. Auction-Specific Terms",
    paragraphs: [
      "Each auction, sale, or lot may be subject to additional notices, estimates, reserves, special conditions, shipping restrictions, import/export requirements, or tax treatment.",
      "Where auction-specific terms apply, they will form part of these Conditions of Business. In the event of conflict, the more specific lot or auction notice will take precedence.",
    ],
  },
  {
    title: "3. Platform Access and Account Approval",
    paragraphs: [
      "LAX.BID may approve, refuse, suspend, or terminate access to the platform at its discretion.",
      "Users may be required to provide identification, payment verification, proof of address, source-of-funds information, source-of-wealth information, ownership documentation, or other compliance material before bidding, buying, selling, consigning property, receiving settlement, or completing a transaction.",
    ],
  },
  {
    title: "4. Compliance and Verification",
    paragraphs: [
      "LAX.BID may conduct anti-money laundering, sanctions, fraud-prevention, source-of-funds, source-of-wealth, payment-risk, and ownership checks.",
      "LAX.BID may delay, suspend, cancel, or refuse any transaction, consignment, registration, bid, settlement, or release of property where verification is incomplete, concerns arise, or legal or regulatory obligations require it.",
      "We must comply with applicable anti-money-laundering, counter-terrorist-financing and sanctions laws, including the Money Laundering, Terrorist Financing and Transfer of Funds (Information on the Payer) Regulations 2017. We may not transact with any person who is the target of sanctions, and we may report and, where required, suspend or freeze a transaction without liability to you. Information collected for these purposes is handled under our Privacy Notice.",
    ],
  },
  {
    title: "5. Catalogue Information and Estimates",
    paragraphs: [
      "Catalogue descriptions, images, estimates, condition notes, provenance statements, market commentary, and related materials are statements of opinion only and are not exhaustive factual representations or warranties. There may be gaps and inconsistencies in the description of items, and it is important that where possible you inspect the item carefully yourself before purchase.",
      "Estimates are provided as a guide only and do not guarantee sale price, resale value, market performance, future demand, or future liquidity.",
      "Nothing in this clause limits the statutory right of a Consumer to goods that match their description, or any other term implied by the Consumer Rights Act 2015 that cannot lawfully be excluded.",
    ],
  },
  {
    title: "6. No Investment, Financial, Legal or Tax Advice",
    paragraphs: [
      "Nothing published by LAX.BID constitutes financial, investment, legal, tax, or professional advice.",
      "Buyers and sellers should obtain independent advice where appropriate.",
      "LAX.BID does not provide investment advice, tax advice, legal advice, regulated financial advice, or any assurance as to future value, resale price, liquidity, or market performance.",
    ],
  },
];

const buyerSections: TermsSection[] = [
  {
    id: "buyers",
    title: "Part B — Conditions for Buyers",
    paragraphs: [],
  },
  {
    title: "7. Registration to Bid",
    paragraphs: [
      "To bid, buyers must register for an account and may be required to provide identification, payment details, billing information, delivery information, and any additional information reasonably required by LAX.BID.",
      "LAX.BID may impose bidding limits, deposits, payment guarantees, additional verification, or approval requirements before allowing participation in an auction or sale.",
      "LAX.BID may refuse, suspend, or revoke bidding access at its discretion.",
    ],
  },
  {
    title: "8. Binding Bids",
    paragraphs: [
      "All bids are binding and irrevocable once placed.",
      "By bidding, the buyer confirms that they:",
    ],
    bullets: [
      "are legally capable of entering into a binding contract",
      "are bidding as principal unless disclosed otherwise",
      "have reviewed the lot description and any available condition information",
      "accept responsibility for paying the full purchase price if successful",
      "understand that buyer’s premium, VAT, shipping, storage, duties, taxes, and other applicable charges may apply",
      "accept these Conditions of Business and any auction-specific terms",
      "understand bids may not be withdrawn once submitted unless LAX.BID expressly permits this in writing",
    ],
  },
  {
    title: "9. Reserves and Auction Close",
    paragraphs: [
      "Some Lots may be subject to a reserve price. A lot will not knowingly be sold below reserve unless authorised.",
      "The highest bid accepted by LAX.BID at the close of the auction will be the winning bid, subject to the reserve and any auction-specific conditions. Lots may have bids that are withdrawn which may mean that a bid lower than that previous price wins.",
      "For timed online auctions, bidding closes at the stated time, subject to any “soft close”: where a bid is placed in the final minutes for a Lot, the closing time for that Lot may be automatically extended (typically by a few minutes) until no further bids are received. Bid increments, automatic / proxy bidding and any currency converter shown on the platform operate as a guide only; the GBP amount recorded by us governs.",
      "LAX.BID may resolve bidding disputes, reject bids, re-open bidding, withdraw lots, correct errors, amend the auction process, or cancel a sale where it reasonably considers this necessary.",
    ],
  },
  {
    title: "10. Contract Formation",
    paragraphs: [
      "A binding contract of sale is formed between buyer and seller when the auction closes and the lot is sold to the highest accepted bidder, or when LAX.BID confirms a private sale or post-auction sale in writing.",
      "The buyer is then legally responsible for payment of the full purchase price and any applicable charges.",
    ],
  },
  {
    title: "11. Buyer’s Premium, VAT and Charges",
    paragraphs: ["The total amount payable by the buyer may include:"],
    bullets: [
      "hammer price",
      "buyer’s premium",
      "VAT on the buyer’s premium, where applicable",
      "VAT on the lot, where applicable",
      "Artist’s Resale Right, where applicable",
      "import VAT, customs duties, clearance fees, or local taxes",
      "shipping, handling, insurance, storage, and administrative charges",
      "any other charges stated in the relevant invoice, catalogue, lot notice, or auction-specific terms",
    ],
    trailingParagraphs: [
      `Unless stated otherwise, LAX.BID’s buyer’s premium is ${SITE_BUYERS_PREMIUM_STANDARD} on the hammer price up to ${SITE_BUYERS_PREMIUM_THRESHOLD} and ${SITE_BUYERS_PREMIUM_ABOVE_THRESHOLD} on any balance above ${SITE_BUYERS_PREMIUM_THRESHOLD}.`,
      `UK VAT is charged on the buyer’s premium at the prevailing rate, currently ${SITE_UK_VAT_RATE}, unless otherwise stated.`,
      "Lots may be sold under the VAT margin scheme or under normal VAT rules; by default VAT will be charged at the usual rate but otherwise the treatment of a Lot is indicated in the catalogue or invoice. Where Artist’s Resale Right applies, ARR is payable in addition to the Purchase Price and, unless stated otherwise, is charged to the Buyer at the rates set by the Artist’s Resale Right Regulations 2006. We will tell a Consumer Buyer the total Purchase Price, including all premiums, taxes and known charges, before the contract is concluded.",
    ],
  },
  {
    title: "12. Payment",
    paragraphs: [
      "Invoices are issued in GBP unless a lot states otherwise.",
      "Payment is due within seven calendar days of invoice unless otherwise agreed in writing.",
      "Payment methods may include bank transfer, card payment, or other approved payment methods. LAX.BID may restrict payment methods depending on transaction value, jurisdiction, compliance status, payment risk, fraud risk, or internal risk assessment.",
      "Title will not pass to the buyer until LAX.BID has received full cleared funds for all sums due.",
      "We may charge interest on overdue sums at 4% per year above the Bank of England base rate from time to time, accruing daily from the due date until payment. We will not impose a surcharge on payment by a Consumer’s debit or credit card beyond the cost to us of accepting that payment, in line with the Consumer Rights (Payment Surcharges) Regulations 2012.",
    ],
  },
  {
    title: "13. Late Payment and Buyer Default",
    paragraphs: [
      "If payment is not received by the due date, LAX.BID may, to the extent caused by breach, and without limiting any other rights or remedies:",
    ],
    bullets: [
      "cancel the sale",
      "re-offer or resell the lot",
      "recover any shortfall between the original sale price and resale price",
      "recover any storage costs and any additional resale costs",
      "retain any deposit or partial payment to the extent permitted by law",
      "suspend or permanently restrict the buyer’s account",
      "report the buyer to other platforms as being unreliable",
      "reject future bids or registrations from the buyer",
      "set off any amounts owed against sums otherwise due to the buyer",
      "hold the buyer responsible for losses arising from default, subject to applicable law",
    ],
    trailingParagraphs: [
      "Please note that if LAX.BID is required to cancel the sale, then having fulfilled their obligation to sell the item, LAX.BID may still seek to recover the Buyer's Premium that LAX.BID was owed for procuring the sale.",
    ],
  },
  {
    title: "14. Condition, Attribution and Provenance",
    paragraphs: [
      "All lots are sold in the condition they are in at the time of sale.",
      "Buyers are responsible for satisfying themselves as to condition, attribution, authenticity, provenance, dimensions, medium, edition details, restoration, framing, defects, completeness, and suitability for export, import, installation, display, operation, use, or storage.",
      "Condition reports and provenance information may be available on request. Buyers should request and review any available condition information before bidding.",
    ],
  },
  {
    title: "15. Authenticity",
    paragraphs: [
      "Where LAX.BID provides an express authenticity guarantee, the scope, duration, procedure, and exclusions of that guarantee will be stated separately.",
      "Unless expressly stated, LAX.BID does not provide an unlimited warranty of authenticity, attribution, value, future saleability, market performance, or investment outcome.",
      "Descriptions, certificates, provenance statements, references to artist, studio, estate, publisher, foundry, gallery, or previous ownership are given as matters of opinion and available information unless expressly warranted in writing.",
    ],
  },
  {
    title: "16. Collection, Shipping and Delivery",
    paragraphs: [
      "Buyers are responsible for arranging collection or delivery after payment has cleared.",
      "LAX.BID may assist with shipping, packaging, customs, or logistics as a convenience.",
      "Unless otherwise agreed in writing, shipping, insurance, import duties and taxes are at the buyer’s cost; third-party carriers, shippers, customs agents, and storage providers act independently; delivery timings are estimates only; and risk in transit rests with the buyer once the lot is released to the buyer, the buyer’s representative, or the appointed carrier.",
      "Where the Buyer is a Consumer and we agree to arrange delivery, the Lot remains at our risk until it is delivered into the Consumer’s physical possession, under section 29 of the Consumer Rights Act 2015. Risk passes earlier only where the Consumer (and not we) engages a carrier of the Consumer’s own choosing. However, in many cases the buyer will procure their own shipping and in such circumstances our liability ends at the point it is picked up.",
    ],
  },
  {
    title: "17. Transfer of Risk and Title",
    paragraphs: [
      "Title to the lot passes only when LAX.BID has received full cleared funds for all sums due.",
      "Risk passes to the buyer upon the earlier of collection by the buyer or their appointed carrier. After risk has passed, the buyer is responsible for storage, insurance, loss, damage, deterioration, and any associated costs.",
    ],
  },
  {
    title: "18. Storage",
    paragraphs: [
      "If a lot is not collected within the stated collection period, LAX.BID may arrange storage at the buyer’s expense.",
      "Storage, handling, insurance, and administrative charges may be added to the buyer’s account.",
      "LAX.BID is not responsible for loss, damage, deterioration, or delay arising from delayed collection except where caused by its proven negligence.",
    ],
  },
  {
    title: "19. Cancellation, Returns and Refunds",
    paragraphs: [
      "Auction sales are generally final.",
      "Where a lot is sold by public auction, cancellation rights will not apply in the same way as ordinary online retail purchases, if you have been provided with the opportunity to inspect the items in person, which is usually the case with our auctions. Please always enquire to inspect the items you are bidding on if you are in any doubt.",
      "Refunds or cancellations will only be considered where required by law, expressly agreed by LAX.BID in writing, or covered by a specific written guarantee.",
      "Nothing in these Conditions affects any statutory rights that cannot lawfully be excluded.",
    ],
  },
];

const sellerSections: TermsSection[] = [
  {
    id: "sellers",
    title: "Part C — Conditions for Sellers and Consignors",
    paragraphs: [],
  },
  {
    title: "20. Submission and Acceptance of Property",
    paragraphs: [
      "All property submitted to LAX.BID is subject to review.",
      "LAX.BID may accept or decline any item at its discretion, including on the basis of market suitability, condition, provenance, authenticity, title, valuation, category demand, documentation, compliance risk, reputational risk, and commercial fit with the relevant auction or sale.",
      "Submission does not guarantee acceptance into auction, private sale, or post-auction sale.",
    ],
  },
  {
    title: "21. Appointment of LAX.BID",
    paragraphs: [
      "By consigning property, the seller appoints LAX.BID as agent to inspect, catalogue, market, photograph, promote, offer, auction, sell, invoice, collect payment, arrange logistics, manage documentation, and administer the post-sale process in relation to the consigned property.",
      "Unless expressly agreed otherwise, LAX.BID acts as agent and does not take ownership of the property.",
    ],
  },
  {
    title: "22. Seller Warranties",
    paragraphs: [
      "LAX.BID requests of all sellers that they warrant the following – such warranties are however, not provided by LAX.BID and the buyer may only seek redress in respect of such a warranty from the relevant seller of any given item. Sellers confirm that:",
    ],
    bullets: [
      "they are the legal and beneficial owner of the lot, or are duly authorised to sell it",
      "the lot is free from liens, charges, claims, disputes, restrictions, or encumbrances",
      "the lot is authentic to the best of the seller’s knowledge and belief, or qualified in such a way as to not be misleading",
      "all provenance, title, ownership, and attribution information provided is accurate and complete",
      "the lot has not been stolen, illegally exported, illegally imported, unlawfully excavated, or otherwise unlawfully obtained",
      "the seller has disclosed all material defects, repairs, restorations, damage, or known concerns",
      "the seller has the right to sell the lot in the United Kingdom and, where relevant, internationally",
      "the seller is not subject to sanctions or other legal restrictions that would prevent sale",
      "the sale of the lot will not breach any law, agreement, third-party right, or regulatory requirement",
      "the seller must immediately notify LAX.BID if any warranty becomes inaccurate or incomplete",
    ],
  },
  {
    title: "23. Seller Indemnity",
    paragraphs: [
      "To the extent that a seller is in breach of these terms and the losses that occur as a result are reasonably foreseeable, the seller agrees to indemnify LAX.BID against any loss, liability, claim, cost, damage, legal expense, settlement, refund, chargeback, regulatory action, or reputational harm arising from defective title, inaccurate information, authenticity disputes, provenance claims, undisclosed restoration or condition issues, third-party ownership claims, breach of seller warranties, illegal import, export, sale, possession, or transfer, buyer claims caused by seller misrepresentation or omission, or any failure by the seller to provide complete and accurate documentation.",
      "This indemnity survives sale completion, withdrawal of the lot, cancellation of the sale, and termination of the consignment relationship.",
    ],
  },
  {
    title: "24. Reserves and Estimates",
    paragraphs: [
      "A reserve price may be agreed in writing before sale.",
      "Unless agreed otherwise, LAX.BID may determine catalogue estimates; estimates are not guarantees of sale price; LAX.BID may advise on reserve strategy; a lot will not knowingly be sold below its agreed reserve without seller consent; and LAX.BID may decline to offer a lot if it considers the reserve commercially unrealistic.",
      "LAX.BID may revise estimates, catalogue descriptions, lot placement, or sale strategy where it considers this appropriate.",
    ],
  },
  {
    title: "25. Seller Commission, Fees and Expenses",
    paragraphs: [
      "Seller commission, marketing charges, insurance, photography, storage, restoration, framing, transport, cataloguing, administrative fees, and other sale-related costs may apply.",
      "The applicable commission and charges will be confirmed in the consignment agreement, sale schedule, or written instructions or online.",
      "LAX.BID may deduct commission, expenses, taxes, and charges from sale proceeds before settlement to the seller.",
    ],
  },
  {
    title: "26. Marketing and Lot Presentation",
    paragraphs: [
      "The seller authorises LAX.BID to photograph, film, describe, catalogue, promote, advertise, publish, and otherwise market the consigned lot.",
      "LAX.BID has discretion over catalogue placement, photography, description style, auction timing, marketing channels, lot grouping, editorial positioning, estimates, promotional material, and whether to offer the lot by auction, private sale, or post-auction sale.",
      "LAX.BID may use images, descriptions, sale results, and related information for marketing, archival, editorial, platform, valuation-reference, and promotional purposes and the Seller grants us a non-exclusive, royalty-free licence to use such images and descriptions for these purposes, including after the sale. We own the copyright in catalogue text, photography and other materials we create, which the Seller must not reproduce without our consent. The Seller warrants that our use of any materials the Seller supplies will not infringe any third-party right.",
    ],
  },
  {
    title: "27. Exclusivity During Consignment",
    paragraphs: [
      "Unless otherwise agreed in writing, once a lot is consigned to LAX.BID, the seller must not sell, offer, advertise, pledge, withdraw, transfer, or otherwise dispose of the lot outside LAX.BID during the consignment period.",
      "This protects pricing integrity, catalogue accuracy, buyer confidence, and auction availability.",
    ],
  },
  {
    title: "28. Withdrawal by Seller",
    paragraphs: [
      "A seller may not withdraw a lot once it has been catalogued, marketed, listed, promoted, or entered into an auction without LAX.BID’s written consent.",
      "If a seller withdraws a lot, LAX.BID may charge marketing costs, photography and cataloguing costs, transport and storage costs, insurance costs, administrative fees, any applicable withdrawal fee, and lost commission where the withdrawal occurs after meaningful sale activity has begun.",
      "Charges on withdrawal will reflect our reasonable costs actually incurred and, where the Seller is a Consumer, will not exceed those costs and any genuine pre-estimate of lost commission or buyers premium.",
    ],
  },
  {
    title: "29. Unsold Lots",
    paragraphs: [
      "If a lot does not sell, LAX.BID may, with seller authorisation or under the relevant consignment agreement, re-offer the lot in a future auction, offer the lot by private sale, adjust the estimate or reserve, return the lot to the seller, continue marketing the lot for a defined post-auction period, or recommend alternative sale strategies.",
      "The seller remains responsible for return, storage, insurance, and unsold-lot costs unless otherwise agreed.",
    ],
  },
  {
    title: "30. Seller Settlement",
    paragraphs: [
      "LAX.BID will settle sale proceeds to the seller only after the buyer has paid in full; funds have cleared; any compliance checks have been completed; the buyer’s payment is not subject to unresolved dispute, reversal, or chargeback risk; and LAX.BID has deducted commission, expenses, taxes, and agreed charges.",
      "Standard settlement will be made within 10 business days after full cleared buyer payment, unless otherwise agreed in writing.",
      "LAX.BID may withhold settlement where there is a title issue, authenticity concern, buyer dispute, chargeback risk, legal claim, regulatory concern, incomplete seller information, or any other matter that may expose LAX.BID to legal, financial, compliance, or reputational risk.",
    ],
  },
  {
    title: "31. Buyer Default",
    paragraphs: [
      "If a buyer fails to pay, LAX.BID is not required to pay the seller.",
      "LAX.BID may, at its discretion, cancel the sale, pursue the buyer, re-offer the lot, arrange a private sale, return the lot to the seller, or take reasonable action to mitigate loss.",
      "The seller acknowledges that LAX.BID’s obligation to remit proceeds depends on receipt of full cleared funds from the buyer.",
    ],
  },
  {
    title: "32. Risk, Insurance and Custody",
    paragraphs: [
      "Unless otherwise agreed, risk remains with the seller until the lot is sold and risk transfers to the buyer under these Conditions.",
      "Where LAX.BID takes physical possession of a lot, LAX.BID will take reasonable care of the lot while in its custody.",
      "The seller is responsible for ensuring that adequate insurance is in place unless LAX.BID confirms in writing that insurance has been arranged.",
      "LAX.BID is not liable for loss or damage caused by existing defects, inherent vice, fragility, poor prior restoration, frames, glazing, mounts, or packaging, third-party carriers or storage providers, environmental factors outside LAX.BID’s reasonable control, war, terrorism, civil disturbance, fire, flood, force majeure events, or any event outside LAX.BID’s reasonable control.",
    ],
  },
  {
    title: "33. Seller Documentation",
    paragraphs: [
      "The seller must provide all documents reasonably requested by LAX.BID, including where applicable proof of identity, proof of address, proof of ownership, invoices, certificates of authenticity, provenance documents, edition documentation, condition records, import/export documents, artist, studio, gallery, publisher, foundry, or estate correspondence, restoration records, insurance documents, and any other document reasonably required to support title, authenticity, provenance, saleability, or compliance.",
      "LAX.BID may refuse to offer, list, market, sell, release, or settle a lot until satisfactory documentation has been provided.",
    ],
  },
  {
    title: "34. Seller Tax Responsibility",
    paragraphs: [
      "The seller is responsible for their own tax affairs, including any income tax, capital gains tax, VAT, import VAT, customs duty, or other taxes arising from sale.",
      "LAX.BID does not provide tax advice.",
    ],
  },
];

const legalSections: TermsSection[] = [
  {
    id: "legal",
    title: "Part D — Common Legal Provisions",
    paragraphs: [],
  },
  {
    title: "35. Platform Errors and Technical Issues",
    paragraphs: [
      "LAX.BID may correct errors in listings, bidding, pricing, estimates, invoices, descriptions, sale results, account information, or platform functionality.",
      "LAX.BID is not liable for missed bids, failed bids, connectivity issues, system outages, display errors, timing discrepancies, data delays, or third-party technology failures.",
      "Where a technical error materially affects an auction, LAX.BID may cancel, suspend, reopen, extend, amend, or otherwise adjust the auction process.",
    ],
  },
  {
    title: "36. Conduct",
    paragraphs: [
      "LAX.BID may refuse service, cancel bids, suspend accounts, withdraw property, withhold settlement, or terminate participation where conduct appears fraudulent, abusive, collusive, misleading, unlawful, reputationally harmful, commercially improper, inconsistent with the integrity of the platform, or likely to expose LAX.BID to legal, financial, compliance, or reputational risk.",
    ],
  },
  {
    title: "37. Force Majeure",
    paragraphs: [
      "LAX.BID is not liable for delay or failure to perform caused by events outside its reasonable control, including technical outages, cyber incidents, transport disruption, labour disputes, regulatory action, natural disaster, fire, flood, war, terrorism, pandemic, government restrictions, failure of third-party service providers, or any other event outside its reasonable control.",
    ],
  },
  {
    title: "38. Limitation of Liability",
    paragraphs: [
      "To the fullest extent permitted by law, LAX.BID is not liable for loss of profit, loss of opportunity, loss of expected value, market movement, indirect or consequential loss, reliance on estimates, opinions, catalogue descriptions, or market commentary, buyer default, seller default, third-party shipping, storage, payment, or technology failures, platform interruptions or outages, delayed payment caused by compliance, banking, or buyer-payment issues, or any loss arising from matters outside LAX.BID’s reasonable control.",
      "LAX.BID’s total liability in connection with any lot shall not exceed the commission or buyer’s premium actually received by LAX.BID in respect of that lot, except where liability cannot lawfully be limited.",
      "Nothing in these Conditions excludes or limits liability for fraud or fraudulent misrepresentation, for death or personal injury caused by negligence, for breach of the terms implied by the Consumer Rights Act 2015 or the Sale of Goods Act 1979, or for any other liability that cannot lawfully be excluded or limited.",
    ],
  },
  {
    title: "39. Data Protection and Privacy",
    paragraphs: [
      "Use of LAX.BID is subject to the platform’s Privacy Notice and Cookie Policy.",
      "LAX.BID may process personal data for account administration, compliance, payment processing, fraud prevention, marketing, logistics, transaction management, dispute handling, and legal or regulatory purposes. We process personal data as a controller under the UK GDPR and the Data Protection Act 2018. Our Privacy Notice explains the lawful bases on which we process data and the rights available to you.",
    ],
  },
  {
    title: "40. Amendments",
    paragraphs: [
      "LAX.BID may amend these Conditions of Business from time to time.",
      "The version applicable to a transaction will be the version in force at the time of bidding, purchase, consignment, or sale, unless otherwise required by law.",
    ],
  },
  {
    title: "41. Severability",
    paragraphs: [
      "If any provision of these Conditions is found to be invalid, unlawful, or unenforceable, the remaining provisions shall continue in full force and effect.",
    ],
  },
  {
    title: "42. Governing Law and Jurisdiction",
    paragraphs: [
      "These Conditions of Business are governed by the laws of England and Wales.",
      "The courts of England and Wales shall have exclusive jurisdiction over any dispute arising from or connected with these Conditions, any auction, any consignment, any private sale, any post-auction sale, or any transaction conducted through LAX.BID.",
    ],
  },
  {
    title: "43. Complaints and Dispute Resolution",
    paragraphs: [
      "If you have a complaint, please contact us using the details on the platform and we will try to resolve it promptly. If we cannot resolve a Consumer complaint, you may be entitled to use an alternative dispute resolution (ADR) scheme; we will tell you whether we agree to use a particular ADR provider. This does not affect your right to bring court proceedings.",
    ],
  },
  {
    title: "44. General",
    paragraphs: [
      "These Conditions, together with any auction-specific terms and consignment agreement, form the entire agreement between us in relation to a transaction and supersede any prior understanding, save that nothing limits liability for fraudulent misrepresentation.",
    ],
  },
];

const allSections = [...generalSections, ...buyerSections, ...sellerSections, ...legalSections];

function termsSectionId(section: TermsSection): string {
  if (section.id) return section.id;
  return section.title
    .replace(/^\d+\.\s*/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function TermsContent({ section }: { section: TermsSection }) {
  return (
    <section className="space-y-6">
      <LegalH2 id={termsSectionId(section)} className="scroll-mt-28">
        {section.title}
      </LegalH2>
      {section.paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {section.bullets ? (
        <LegalUL>
          {section.bullets.map((item) => (
            <li key={item}>{item}.</li>
          ))}
        </LegalUL>
      ) : null}
      {section.trailingParagraphs?.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </section>
  );
}

export default function TermsPage() {
  return (
    <PolicyHubLayout>
      <script type="application/ld+json" suppressHydrationWarning>
        {policyHubPageJsonLd({
          path: "/terms",
          breadcrumbName: "Conditions of Business",
          pageName: "LAX.BID — Conditions of Business",
          description:
            "Conditions of Business governing auctions, private sales, bidding, and consignments on LAX.BID by London Art Exchange.",
        })}
      </script>
      <LegalPage
        title="LAX.BID — Conditions of Business"
        toc={[...toc]}
        lastUpdated="17 June 2026"
        kicker={null}
        dividerUnderDate
        embedded
      >
        <p>
          These Conditions of Business govern the use of {SITE_NAME} and apply to all persons who
          register, bid, buy, consign, submit, sell, or otherwise participate in any auction,
          private sale, post-auction sale, or related transaction conducted through {SITE_NAME}.
        </p>
        <p>
          {SITE_NAME} is a curated auction and private sale platform specialising in fine art,
          collectibles, cultural property, and select luxury assets. Unless expressly stated
          otherwise, {SITE_NAME} acts as agent for the seller of each lot.
        </p>
        <p>
          By using the platform, registering to bid, placing a bid, submitting property for sale,
          consigning a lot, or completing a transaction, you agree to be bound by these Conditions
          of Business, together with any auction-specific notices, catalogue notes, lot
          descriptions, consignment agreements, invoice terms, and written instructions issued by{" "}
          {SITE_NAME}.
        </p>
        <p>
          {SITE_NAME} is operated by {SITE_LEGAL_NAME}, a company registered in England and Wales
          (the “Company”, “we”, “us” or “our”). References to “{SITE_NAME}” in these Conditions mean{" "}
          {SITE_LEGAL_NAME}. We are registered with HMRC as an art market participant for
          anti-money-laundering purposes.
        </p>
        <p>
          Nothing in these Conditions of Business excludes, restricts or affects your statutory
          rights as a consumer that cannot lawfully be excluded. Where you deal with us as a
          consumer (an individual acting wholly or mainly outside a trade, business, craft or
          profession), the consumer-specific provisions below apply and, in the event of conflict,
          prevail.
        </p>
        <section className="space-y-6">
          <LegalH2 id="interpretation" className="scroll-mt-28">
            Interpretation
          </LegalH2>
          <p>
            In these Conditions: “Buyer” means the person to whom a Lot is sold; “Consumer” has the
            meaning in section 2 of the Consumer Rights Act 2015; “Seller” or “Consignor” means the
            person who consigns a Lot for sale; “Lot” means an item or items offered for sale
            through {SITE_NAME}; “Hammer Price” means the amount of the highest bid accepted for a
            Lot; “Buyer’s Premium” means the charge payable by the Buyer under clause 11; “Purchase
            Price” means the Hammer Price plus the Buyer’s Premium and any applicable VAT, Artist’s
            Resale Right and other charges; “ARR” means the royalty payable under the Artist’s
            Resale Right Regulations 2006; “Business Day” means a day other than a Saturday, Sunday
            or public holiday in England; and “writing” includes email.
          </p>
        </section>
        {allSections.map((section) => (
          <TermsContent key={section.title} section={section} />
        ))}
      </LegalPage>
    </PolicyHubLayout>
  );
}
