import { SHOP_POLICY_FACTS as F } from "./shop-policy-facts";
import type { ShopPolicyDocument } from "./shop-policy.types";

export const TERMS_OF_SALE: ShopPolicyDocument = {
  slug: "terms",
  title: "Terms of sale",
  summary:
    "The terms that apply when you buy a limited-edition print from LAX Shop: who we are, prices, your order, delivery, your right to cancel and what happens if something is wrong.",
  sections: [
    {
      id: "about-these-terms",
      heading: "About these terms",
      blocks: [
        {
          type: "paragraph",
          text: "These terms apply when you buy a limited-edition print from LAX Shop as a consumer, that is, for your own use and not for a business. Please read them before you place an order. By placing an order you agree to them.",
        },
        {
          type: "paragraph",
          text: "They do not cover original artworks, which are sold on lax.art, or lots bought at auction on LAX Bid. Those have their own terms.",
        },
        {
          type: "paragraph",
          text: "We may change these terms from time to time. The terms that apply to your order are the ones shown here when you place it. We suggest you save or print a copy.",
        },
        {
          type: "paragraph",
          text: "Nothing in these terms affects your legal rights as a consumer.",
        },
      ],
    },
    {
      id: "who-we-are",
      heading: "Who we are",
      blocks: [
        {
          type: "paragraph",
          text: `LAX Shop is run by **${F.sellerLegalName}**, trading as ${F.sellerTradingName} (“LAX”, “we”, “us”). [TO CONFIRM: trading name as it should appear on the terms]`,
        },
        { type: "company" },
        {
          type: "list",
          items: [`Email: ${F.contactEmail}`, `Phone: ${F.contactPhone}, ${F.contactHours}`],
        },
        {
          type: "paragraph",
          text: "You can also reach us through [Help and contact](/help).",
        },
      ],
    },
    {
      id: "what-we-sell",
      heading: "What we sell",
      blocks: [
        {
          type: "paragraph",
          text: "LAX Shop sells limited-edition prints. Each product page shows the size of the edition, the dimensions, the medium and whether a certificate of authenticity is included.",
        },
        {
          type: "list",
          items: [
            "**Edition numbers.** We assign the edition number to your order once your payment is confirmed, and show it in [Your orders](/account/orders). We cannot promise a particular number. [TO CONFIRM: edition numbers are assigned at payment and buyers cannot choose one]",
            "**Certificates of authenticity.** Where the product page says a certificate is included, it is issued for your edition number and sent with your print or made available in your order. [TO CONFIRM: how certificates are issued (printed in the parcel, digital download, or both)]",
            "**Images and colours.** We photograph our prints carefully, but colours vary between screens and the print you receive may look slightly different from the image.",
            "**Sizes.** Sizes are shown on the product page. [TO CONFIRM: size tolerance, if any, for example ±5 mm for hand-finished prints]",
          ],
        },
      ],
    },
    {
      id: "prices-and-payment",
      heading: "Prices and payment",
      blocks: [
        {
          type: "list",
          items: [
            "Prices are in pounds sterling (£) and include VAT at the current rate.",
            "Delivery or collection is charged separately. You see the cost at checkout before you pay. See [Delivery and collection](/delivery).",
            "You pay by card on a secure payment page run by our payment provider, Stripe. We do not see or store your full card details.",
            "We take payment when you place your order.",
          ],
        },
        {
          type: "paragraph",
          text: "If we find that a price was wrong before we send your print, we will contact you. You can then choose to go ahead at the correct price or cancel for a full refund.",
        },
      ],
    },
    {
      id: "your-order",
      heading: "Your order and our contract",
      blocks: [
        {
          type: "list",
          ordered: true,
          items: [
            "Add a print to your basket and go to checkout.",
            "Choose delivery or collection and check your details. You can go back and correct anything before you pay.",
            "Pay on the secure payment page.",
            "We email you to confirm your order. Your order also appears in [Your orders](/account/orders).",
          ],
        },
        {
          type: "paragraph",
          text: "Our contract with you starts when we send the order confirmation. [TO CONFIRM: the contract is formed when the confirmation email is sent, not on dispatch]",
        },
        {
          type: "paragraph",
          text: "If we cannot accept your order, for example because the last print in the edition sold at the same moment, we will tell you and refund you in full.",
        },
        {
          type: "paragraph",
          text: "Our contract is in English.",
        },
      ],
    },
    {
      id: "delivery",
      heading: "Delivery, collection and ownership",
      blocks: [
        {
          type: "paragraph",
          text: "Your delivery and collection options, costs and timings are set out in [Delivery and collection](/delivery). If we have not agreed a delivery date with you, we will deliver within 30 days of your order.",
        },
        {
          type: "paragraph",
          text: "The print is your responsibility from the time it is delivered to you, or to someone you have nominated, or from when you collect it. It becomes yours once we have received full payment.",
        },
      ],
    },
    {
      id: "your-right-to-cancel",
      heading: "Your right to cancel",
      blocks: [
        {
          type: "paragraph",
          text: "You can change your mind and cancel your order within 14 days of the day you receive your print, without giving a reason. You can also cancel at any time between placing your order and receiving it.",
        },
        {
          type: "paragraph",
          text: "How to cancel, how to return the print and when you will be refunded are set out in [Cancellations and returns](/returns).",
        },
        {
          type: "paragraph",
          text: "The right to cancel does not apply to items made to your specification or clearly personalised. [TO CONFIRM: whether any Shop items are made to order or personalised; if none, remove this paragraph]",
        },
      ],
    },
    {
      id: "if-something-is-wrong",
      heading: "If something is wrong with your print",
      blocks: [
        {
          type: "paragraph",
          text: "We must give you a print that is as described, of satisfactory quality and fit for purpose. If it is not, the Consumer Rights Act 2015 gives you these rights:",
        },
        {
          type: "list",
          items: [
            "**Up to 30 days** after delivery you can reject the print and get a full refund.",
            "**After 30 days**, or if you prefer, you can ask us to repair or replace it. As editions are limited, a replacement may not be possible; if it is not, or a repair fails, you can have a refund or a price reduction.",
            "**Up to 6 months** after delivery, a fault is assumed to have been there at delivery unless we can show otherwise.",
            "**Up to 6 years** after delivery (5 years in Scotland), you may still have rights, but you may need to show the fault was there at delivery.",
          ],
        },
        {
          type: "paragraph",
          text: "Tell us as soon as you can. See [Damaged or faulty prints](/returns#damaged-or-faulty) for what to do.",
        },
      ],
    },
    {
      id: "copyright",
      heading: "Copyright",
      blocks: [
        {
          type: "paragraph",
          text: "When you buy a print you own the physical print. Copyright in the artwork stays with the artist or their estate. You must not copy, reproduce or sell reproductions of the image without their permission.",
        },
      ],
    },
    {
      id: "our-responsibility",
      heading: "Our responsibility to you",
      blocks: [
        {
          type: "paragraph",
          text: "If we break these terms or fail to use reasonable care and skill, we are responsible for loss or damage you suffer that is a foreseeable result. Loss is foreseeable if it is obvious it would happen, or if we both knew it might happen when the contract was made.",
        },
        {
          type: "paragraph",
          text: "We do not exclude or limit our liability for death or personal injury caused by our negligence, for fraud, or for breach of your legal rights in relation to the goods.",
        },
        {
          type: "paragraph",
          text: "We sell to consumers only. We are not responsible for business losses, such as loss of profit or business opportunity.",
        },
      ],
    },
    {
      id: "events-outside-our-control",
      heading: "Events outside our control",
      blocks: [
        {
          type: "paragraph",
          text: "If something outside our control delays your order, such as a courier failure, severe weather or industrial action, we will tell you as soon as we can and do what we reasonably can to reduce the delay. If the delay is likely to be substantial, you can cancel and receive a full refund for anything you have paid for but not received.",
        },
      ],
    },
    {
      id: "your-account-and-data",
      heading: "Your account and personal data",
      blocks: [
        {
          type: "paragraph",
          text: "You sign in to LAX Shop with your LAX Account, where you manage your profile, addresses and security. We use your personal information as described in our privacy notice, linked at the foot of every page.",
        },
      ],
    },
    {
      id: "complaints",
      heading: "Complaints and disputes",
      blocks: [
        {
          type: "paragraph",
          text: `If you are unhappy, please contact us first at ${F.contactEmail}. We will reply within [TO CONFIRM: complaint response time, for example 5 working days] and try to put things right.`,
        },
        {
          type: "paragraph",
          text: "[TO CONFIRM: name of any alternative dispute resolution (ADR) scheme LAX uses, or state that LAX does not use one]",
        },
        {
          type: "paragraph",
          text: "These terms are governed by the law of England and Wales. You can bring claims in the courts of England and Wales. If you live in Scotland or Northern Ireland, you can also bring claims in your local courts.",
        },
      ],
    },
    {
      id: "other-terms",
      heading: "Other important terms",
      blocks: [
        {
          type: "list",
          items: [
            "We may transfer our rights under these terms to another organisation. We will tell you if this happens, and it will not affect your rights.",
            "This contract is between you and us. Nobody else has rights under it.",
            "If a court finds part of these terms unlawful, the rest stays in force.",
            "If we do not enforce our rights straight away, we can still enforce them later.",
          ],
        },
      ],
    },
  ],
};
