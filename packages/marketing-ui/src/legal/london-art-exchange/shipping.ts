import type { LegalPolicyDocument } from "../policy/policy-document.js";

/**
 * Shipping, Delivery, Collection and Storage Policy, as published by London Art Exchange Ltd at https://www.thelax.art/shipping-delivery
 * (version 1.0, effective 2026-08-12). Business-team text: keep the wording and clause numbers.
 */
export const SHIPPING_POLICY: LegalPolicyDocument<"shipping"> = {
  slug: "shipping",
  title: "Shipping, Delivery, Collection and Storage Policy",
  summary: "Delivery, collection, storage and the point at which risk in a work passes to you.",
  sections: [
    {
      id: "delivery-quote-and-timing",
      heading: "1. Delivery quote and timing",
      blocks: [
        {
          type: "paragraph",
          text: "1.1 Before order, we show an available delivery charge or explain how it will be calculated. Where a work cannot normally be returned by post, we also show the cancellation-return cost or a reasonable maximum estimate.",
        },
        {
          type: "paragraph",
          text: "1.2 The order confirmation states the agreed destination and date or estimated window. Unless another period is agreed with a Consumer, delivery will occur without undue delay and no later than 30 days after the contract is made.",
        },
        {
          type: "paragraph",
          text: "1.3 Dispatch is not allowed to remain open-ended while a consignor supplies the work or while we “verify” it. If the work is not in our possession and ready for lawful sale, that fact and a firm or reasonably bounded delivery date must be disclosed before order.",
        },
      ],
    },
    {
      id: "packaging-and-carriers",
      heading: "2. Packaging and carriers",
      blocks: [
        {
          type: "paragraph",
          text: "2.1 We select packaging and a carrier suitable for the work, destination and declared value. The order will state whether delivery includes specialist handling, insurance, installation, unpacking or removal of packaging.",
        },
        {
          type: "paragraph",
          text: "2.2 We contract with the carrier where we offer and arrange delivery. A Consumer does not have to pursue the carrier instead of us for loss or damage for which we retain legal responsibility.",
        },
        {
          type: "paragraph",
          text: "2.3 We use a carrier and packaging method suitable for the work, destination and declared value. We confirm the service, handling arrangements, coverage position and material exclusions for the individual delivery. We describe a shipment as insured only where written cover applies to that work, declared value, route and carrier. Delivery issues must be escalated through Customer Services at info@thelax.art or +44 800 208 4800.",
        },
      ],
    },
    {
      id: "risk-and-title",
      heading: "3. Risk and title",
      blocks: [
        {
          type: "paragraph",
          text: "3.1 For a Consumer delivery arranged by us, risk remains with us until the Consumer or a nominated recipient takes physical possession.",
        },
        {
          type: "paragraph",
          text: "3.2 If a Consumer independently commissions a carrier that we did not offer, risk may pass when the work is delivered to that carrier as the law provides.",
        },
        {
          type: "paragraph",
          text: "3.3 Title to the physical artwork passes after cleared payment in full, subject to mandatory law. Copyright does not pass.",
        },
      ],
    },
    {
      id: "delivery-inspection-and-damage",
      heading: "4. Delivery inspection and damage",
      blocks: [
        {
          type: "paragraph",
          text: "4.1 Where safe, inspect the outer packaging on arrival and record visible damage on the delivery note. Photograph the unopened package, labels, damage and artwork. Keep all packaging while we investigate.",
        },
        {
          type: "paragraph",
          text: "4.2 Contact us as soon as reasonably possible. A prompt report assists evidence but does not waive statutory rights if made later.",
        },
        {
          type: "paragraph",
          text: "4.3 We will arrange a suitable collection, assessment and remedy where the work is damaged or non-conforming.",
        },
      ],
    },
    {
      id: "failed-or-delayed-delivery",
      heading: "5. Failed or delayed delivery",
      blocks: [
        {
          type: "paragraph",
          text: "5.1 Tell us promptly about an address error or access restriction. Extra cost caused by inaccurate information may be charged only where fair, disclosed and reasonably incurred.",
        },
        {
          type: "paragraph",
          text: "5.2 If delivery is delayed, we will give an updated date and explain the Consumer’s right to set an appropriate further deadline or cancel where timing is essential or the legal conditions are met.",
        },
        {
          type: "paragraph",
          text: "5.3 If no one accepts delivery, the carrier may return the work to secure storage. We will give written notice and a new delivery or collection option. Any redelivery or storage charge must be reasonable and disclosed.",
        },
      ],
    },
    {
      id: "collection",
      heading: "6. Collection",
      blocks: [
        {
          type: "paragraph",
          text: "6.1 Collection requires an appointment, cleared payment and identity/authority evidence. We will provide the collection address, opening hours, access information and packaging position in advance.",
        },
        {
          type: "paragraph",
          text: "6.2 Risk passes when the Consumer or nominated collector takes possession. If the Consumer independently appoints a carrier we did not offer, clause 3.2 applies.",
        },
      ],
    },
    {
      id: "storage-and-uncollected-works",
      heading: "7. Storage and uncollected works",
      blocks: [
        {
          type: "paragraph",
          text: "7.1 The order will state any free collection period. A charge after that period applies only if it was disclosed or later agreed and is reasonable.",
        },
        {
          type: "paragraph",
          text: "7.2 We will give reasonable written notice before moving a work to third-party storage. Long-term storage requires separate written terms covering location, access, insurance, charges, risk and termination.",
        },
        {
          type: "paragraph",
          text: "7.3 We will not dispose of or resell a work without a lawful basis and the notices required by law.",
        },
      ],
    },
    {
      id: "international-orders",
      heading: "8. International orders",
      blocks: [
        {
          type: "paragraph",
          text: "8.1 Before contracting, we state the delivery basis and whether the buyer or seller is importer of record and responsible for duty, import VAT, brokerage and permits.",
        },
        {
          type: "paragraph",
          text: "8.2 Dispatch is subject to export licensing, cultural-property, sanctions, CITES, ivory and customs requirements. The buyer must provide destination information and cooperate with lawful checks.",
        },
        {
          type: "paragraph",
          text: "8.3 We do not mark an item at a false value or describe it inaccurately for customs.",
        },
      ],
    },
  ],
} as const;
