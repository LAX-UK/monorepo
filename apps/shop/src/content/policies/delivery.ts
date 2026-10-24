import { SHOP_POLICY_FACTS as F } from "./shop-policy-facts";
import type { ShopPolicyDocument } from "./shop-policy.types";

export const DELIVERY_AND_COLLECTION: ShopPolicyDocument = {
  slug: "delivery",
  title: "Delivery and collection",
  summary: `How we send your print: insured UK delivery for ${F.ukDeliveryPrice} per order, free collection in London, and international delivery by quotation.`,
  sections: [
    {
      id: "options",
      heading: "Your options",
      blocks: [
        {
          type: "paragraph",
          text: "You choose how to receive your order at checkout, and see the cost before you pay. Prices include VAT.",
        },
        {
          type: "table",
          caption: "Delivery and collection options",
          columns: ["Option", "Cost", "When"],
          rows: [
            [
              "UK insured delivery",
              `${F.ukDeliveryPrice} per order`,
              "[TO CONFIRM: delivery time, for example 3 to 5 working days after dispatch]",
            ],
            [
              "Collect from New Cavendish Street, London",
              "Free",
              "[TO CONFIRM: when an order is ready to collect]",
            ],
            [
              "Collect from Brunswick Place, London",
              "Free",
              "[TO CONFIRM: when an order is ready to collect]",
            ],
            [
              "LAX storage",
              F.storagePrice,
              "[TO CONFIRM: what LAX storage includes, how long it lasts and any further charge]",
            ],
            [
              "International delivery",
              "Quoted before you pay",
              "[TO CONFIRM: typical international delivery times]",
            ],
          ],
        },
      ],
    },
    {
      id: "uk-delivery",
      heading: "UK insured delivery",
      blocks: [
        {
          type: "list",
          items: [
            `**Cost:** ${F.ukDeliveryPrice} per order, however many prints you buy.`,
            "**Where:** addresses in the United Kingdom. [TO CONFIRM: whether the Scottish Highlands and islands, Northern Ireland, the Channel Islands and BFPO addresses are covered, and at what cost]",
            "**Dispatch:** [TO CONFIRM: dispatch time, for example within 3 working days of payment]",
            "**Courier and tracking:** [TO CONFIRM: courier used and how tracking details are sent]",
            "**Insurance:** each parcel is insured for the price you paid until it is delivered.",
            "**Signature:** [TO CONFIRM: whether a signature is needed on delivery]",
          ],
        },
        {
          type: "paragraph",
          text: "We ask for a phone number at checkout. The courier uses it only to arrange your delivery.",
        },
        {
          type: "paragraph",
          text: "If we have not agreed a delivery date with you, we will deliver within 30 days of your order.",
        },
      ],
    },
    {
      id: "packaging",
      heading: "Packaging",
      blocks: [
        {
          type: "paragraph",
          text: "[TO CONFIRM: how prints are packed, for example flat between boards or rolled in a tube]",
        },
        {
          type: "paragraph",
          text: "Please open the parcel carefully and check the print as soon as it arrives. Keep the packaging until you are sure you want to keep the print; it is the safest way to send it back.",
        },
      ],
    },
    {
      id: "collection",
      heading: "Collection in London",
      blocks: [
        {
          type: "paragraph",
          text: "Collection is free. We email you when your order is ready.",
        },
        {
          type: "list",
          items: [
            `**New Cavendish Street:** ${F.newCavendishAddress}`,
            `**Brunswick Place:** ${F.brunswickAddress}`,
            "**Opening hours:** [TO CONFIRM: collection opening hours at each location]",
            "**What to bring:** [TO CONFIRM: for example your order confirmation and photo ID]",
            "**Someone else collecting:** [TO CONFIRM: whether someone else can collect for you and what they need to bring]",
            "**How long we hold your order:** [TO CONFIRM: how long an uncollected order is held and what happens after]",
          ],
        },
      ],
    },
    {
      id: "lax-storage",
      heading: "LAX storage",
      blocks: [
        {
          type: "paragraph",
          text: `If you choose LAX storage (${F.storagePrice}), we keep your print for you instead of sending it. [TO CONFIRM: what LAX storage includes, how long it lasts, whether further charges apply and how to arrange delivery or collection later]`,
        },
        {
          type: "paragraph",
          text: "[TO CONFIRM: when the 14-day cancellation period starts for prints kept in LAX storage]",
        },
      ],
    },
    {
      id: "international",
      heading: "International delivery",
      blocks: [
        {
          type: "paragraph",
          text: "International delivery is not yet available to pay for online. Choose “International delivery (quotation)” at checkout and we will email you a quote. You pay nothing until you accept it.",
        },
        {
          type: "paragraph",
          text: "Import duties, taxes and customs charges in the destination country are paid by the recipient. [TO CONFIRM: whether UK VAT is removed from the price for exports]",
        },
        {
          type: "paragraph",
          text: "We plan to offer fixed delivery rates by region in future.",
        },
      ],
    },
    {
      id: "problems",
      heading: "Late, missing or damaged deliveries",
      blocks: [
        {
          type: "paragraph",
          text: `If your print has not arrived when expected, or arrives damaged, use “Report a problem” on the order in [Your orders](/account/orders) or email us at ${F.contactEmail}. ${F.reportProblemNote}`,
        },
        {
          type: "paragraph",
          text: "If it is damaged, please keep the print and all the packaging, and take photos of both. See [Damaged or faulty prints](/returns#damaged-or-faulty).",
        },
      ],
    },
    {
      id: "risk-and-ownership",
      heading: "Responsibility and ownership",
      blocks: [
        {
          type: "paragraph",
          text: "The print is your responsibility once it is delivered to you or to someone you have nominated, or once you collect it. It becomes yours once we have received full payment.",
        },
      ],
    },
  ],
};
