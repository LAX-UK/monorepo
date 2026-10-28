/**
 * Part C of the Conditions of Business, "Conditions for Sellers and Consignors". It is the
 * consignment agreement a seller accepts in the product (version 1), and it is also published
 * as part of the Conditions of Business on /terms. Both read this one source, so the agreement
 * a seller accepts is word for word what the public conditions say.
 */
export type ConditionsSection = {
  id?: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  trailingParagraphs?: string[];
};

export const CONDITIONS_OF_BUSINESS_PART_C: readonly ConditionsSection[] = [
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
    id: "withdrawal-by-seller",
    title: "28. Withdrawal by Seller",
    paragraphs: [
      "A seller may not withdraw a lot once it has been catalogued, marketed, listed, promoted, or entered into an auction without LAX.BID’s written consent.",
      "If a seller withdraws a lot, LAX.BID may charge marketing costs, photography and cataloguing costs, transport and storage costs, insurance costs, administrative fees, any applicable withdrawal fee, and lost commission where the withdrawal occurs after meaningful sale activity has begun.",
      "Charges on withdrawal will reflect our reasonable costs actually incurred and, where the Seller is a Consumer, will not exceed those costs and any genuine pre-estimate of lost commission or buyers premium.",
    ],
  },
  {
    id: "unsold-lots",
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

/** One clause of Part C by its anchor, to show it where it applies. */
export function partCSection(id: "withdrawal-by-seller" | "unsold-lots"): ConditionsSection {
  const section = CONDITIONS_OF_BUSINESS_PART_C.find((s) => s.id === id);
  if (!section) throw new Error(`Part C has no section ${id}`);
  return section;
}
