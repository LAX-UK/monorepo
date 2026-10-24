import { SHOP_POLICY_FACTS as F } from "./shop-policy-facts";
import type { ShopPolicyDocument } from "./shop-policy.types";

/**
 * Shop help is static until the lax.art Help centre can hold Shop questions: its categories and
 * questions have no storefront field yet, so Shop would show gallery answers.
 */
export const HELP_AND_CONTACT: ShopPolicyDocument = {
  slug: "help",
  title: "Help and contact",
  summary:
    "How to reach us, and answers about orders, delivery, returns, editions and your account.",
  sections: [
    {
      id: "contact",
      heading: "Contact us",
      blocks: [
        {
          type: "list",
          items: [
            `**Email:** ${F.contactEmail}`,
            `**Phone:** ${F.contactPhone}`,
            `**Hours:** ${F.contactHours}`,
          ],
        },
        {
          type: "paragraph",
          text: "Include your order reference if your question is about an order. You can find it in [Your orders](/account/orders). [TO CONFIRM: how quickly customer service replies]",
        },
      ],
    },
    {
      id: "orders-and-payment",
      heading: "Orders and payment",
      blocks: [
        {
          type: "list",
          items: [
            "Your orders, their status and edition numbers are in [Your orders](/account/orders).",
            "We take payment by card when you place your order. Prices include VAT.",
            "We email you an order confirmation as soon as payment is confirmed.",
          ],
        },
      ],
    },
    {
      id: "delivery",
      heading: "Delivery and collection",
      blocks: [
        {
          type: "paragraph",
          text: `UK insured delivery is ${F.ukDeliveryPrice} per order. Collection in London is free. International delivery is by quotation. See [Delivery and collection](/delivery).`,
        },
      ],
    },
    {
      id: "returns",
      heading: "Cancellations and returns",
      blocks: [
        {
          type: "paragraph",
          text: "You can cancel within 14 days of receiving your print and we refund you within 14 days of getting it back. If it arrives damaged or faulty, tell us straight away. See [Cancellations and returns](/returns).",
        },
      ],
    },
    {
      id: "editions",
      heading: "Editions and certificates",
      blocks: [
        {
          type: "list",
          items: [
            "A limited edition is a fixed number of prints of one image. The product page shows how many are in the edition.",
            "Your edition number is assigned when your payment is confirmed and shown on your order.",
            "Where a certificate of authenticity is included, it is issued for your edition number. Keep it with the print.",
          ],
        },
      ],
    },
    {
      id: "account",
      heading: "Your account",
      blocks: [
        {
          type: "paragraph",
          text: "You sign in with your LAX Account. Your profile, addresses, payment methods and security settings are managed there, and work across every LAX site.",
        },
      ],
    },
    {
      id: "original-artworks",
      heading: "Original artworks",
      blocks: [
        {
          type: "paragraph",
          text: "LAX Shop sells limited editions. Original artworks, enquiries and gallery visits are on lax.art.",
        },
      ],
    },
  ],
};
