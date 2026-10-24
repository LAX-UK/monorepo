import { SHOP_POLICY_FACTS as F } from "./shop-policy-facts";
import type { ShopPolicyDocument } from "./shop-policy.types";

export const CANCELLATIONS_AND_RETURNS: ShopPolicyDocument = {
  slug: "returns",
  title: "Cancellations and returns",
  summary:
    "You can cancel within 14 days of receiving your print, for any reason, and we refund you within 14 days. Faulty or damaged prints are covered separately.",
  sections: [
    {
      id: "summary",
      heading: "In short",
      blocks: [
        {
          type: "list",
          items: [
            "You have **14 days** from the day you receive your print to cancel, without giving a reason.",
            "Send the print back within **14 days** of telling us, in the condition you received it, with its certificate of authenticity.",
            "We refund you within **14 days** of getting the print back.",
            "If your print is damaged or faulty, we put it right at no cost to you. See [Damaged or faulty prints](#damaged-or-faulty).",
          ],
        },
      ],
    },
    {
      id: "right-to-cancel",
      heading: "Your right to cancel",
      blocks: [
        {
          type: "paragraph",
          text: "Under the Consumer Contracts Regulations 2013 you can cancel your order within 14 days, starting the day after you, or someone you have nominated, receive the print. If you collect your order, the 14 days start the day after you collect it. You do not need to give a reason.",
        },
        {
          type: "paragraph",
          text: "You can also cancel at any time after you place your order and before you receive it.",
        },
        {
          type: "paragraph",
          text: "If your order contains several prints delivered on different days, the 14 days start the day after you receive the last one.",
        },
        {
          type: "paragraph",
          text: "The right to cancel does not apply to items made to your specification or clearly personalised. [TO CONFIRM: whether any Shop items are made to order or personalised; if none, remove this paragraph]",
        },
      ],
    },
    {
      id: "how-to-cancel",
      heading: "How to cancel",
      blocks: [
        {
          type: "paragraph",
          text: "Tell us before the 14 days end, in any of these ways:",
        },
        {
          type: "list",
          items: [
            `Use **Report a problem** on the order in [Your orders](/account/orders) and choose “Changed my mind”. ${F.reportProblemNote}`,
            `Email us at ${F.contactEmail} with your name, order reference and the print you are returning.`,
            "Send us the [model cancellation form](#cancellation-form) below, or any other clear statement that you want to cancel.",
          ],
        },
        {
          type: "paragraph",
          text: "You only need to tell us before the 14 days end. We will confirm by email that we have received your cancellation.",
        },
      ],
    },
    {
      id: "sending-it-back",
      heading: "Sending the print back",
      blocks: [
        {
          type: "paragraph",
          text: `Send the print back, or bring it to us, within 14 days of telling us you are cancelling. Post it to ${F.returnsAddress}. [TO CONFIRM: whether prints can be returned in person at New Cavendish Street or Brunswick Place]`,
        },
        {
          type: "paragraph",
          text: "**Return postage:** [TO CONFIRM: who pays return postage when you change your mind. If the buyer pays, say so here and give an estimated cost, as the law requires this before the order is placed. LAX pays for damaged or faulty prints]",
        },
        {
          type: "paragraph",
          text: "Pack the print as carefully as it was packed for you, ideally in the original packaging. We recommend a tracked service insured for the price you paid, as the print is your responsibility until it reaches us.",
        },
      ],
    },
    {
      id: "condition",
      heading: "Condition of the print",
      blocks: [
        {
          type: "paragraph",
          text: "You can handle and inspect the print as you would in a gallery. Please return it in the condition you received it, with everything that came with it.",
        },
        {
          type: "paragraph",
          text: "If the print has lost value because it was handled more than needed to inspect it, we may reduce your refund to reflect that. Examples include:",
        },
        {
          type: "list",
          items: [
            "framing, mounting, trimming or fixing it to anything;",
            "creases, dents, marks, stains or tears that were not there on delivery;",
            "writing on the print or its certificate.",
          ],
        },
        {
          type: "paragraph",
          text: "[TO CONFIRM: how LAX assesses condition on return and how a reduction is worked out]",
        },
      ],
    },
    {
      id: "edition-and-certificate",
      heading: "Edition number and certificate of authenticity",
      blocks: [
        {
          type: "list",
          items: [
            "Return the same numbered print you received. We check the edition number when it arrives.",
            "Include the certificate of authenticity and any other edition papers. The certificate belongs to that edition number and cannot be kept separately.",
            "If the certificate is not returned, we may reduce your refund. [TO CONFIRM: what happens if the certificate is missing, for example a deduction for reissuing it]",
            "Once we have accepted the return, the certificate is cancelled and the edition number is no longer registered to you. [TO CONFIRM: whether a returned edition is offered for sale again]",
          ],
        },
      ],
    },
    {
      id: "refunds",
      heading: "Refunds",
      blocks: [
        {
          type: "list",
          items: [
            "We refund the price of the print and the delivery cost you paid, up to the cost of our standard UK delivery.",
            "We refund you within 14 days of receiving the print back, or of receiving proof that you have sent it, whichever is earlier.",
            "If you cancel before you receive the print, we refund you within 14 days of you telling us.",
            "We refund to the card you paid with. We do not charge a fee for refunds.",
          ],
        },
      ],
    },
    {
      id: "damaged-or-faulty",
      heading: "Damaged or faulty prints",
      blocks: [
        {
          type: "paragraph",
          text: `If your print arrives damaged, is faulty or is not as described, tell us as soon as you can using **Report a problem** on the order or by email at ${F.contactEmail}. [TO CONFIRM: any time within which LAX asks to hear about transit damage, for example 48 hours; this cannot limit the buyer’s legal rights]`,
        },
        {
          type: "list",
          items: [
            "Keep the print and all the packaging.",
            "Send us photos of the damage, the packaging and the edition number.",
            "We will arrange and pay for the return, or collect it from you.",
          ],
        },
        {
          type: "paragraph",
          text: "Within 30 days of delivery you can choose a full refund, including delivery. After that we will offer a repair, a replacement or a refund. As editions are limited, a replacement may not be possible; if it is not, we refund you. These rights come from the Consumer Rights Act 2015 and are in addition to your right to cancel. See [our terms](/terms#if-something-is-wrong).",
        },
      ],
    },
    {
      id: "cancellation-form",
      heading: "Model cancellation form",
      blocks: [
        {
          type: "paragraph",
          text: "You do not have to use this form. Copy it into an email or letter, or print this page.",
        },
        {
          type: "panel",
          title: "Cancellation form",
          blocks: [
            {
              type: "paragraph",
              text: `To ${F.sellerLegalName}, ${F.returnsAddress}, ${F.contactEmail}:`,
            },
            {
              type: "paragraph",
              text: "I/We* hereby give notice that I/We* cancel my/our* contract of sale of the following goods:",
            },
            {
              type: "list",
              items: [
                "Print and edition number:",
                "Order reference:",
                "Ordered on* / received on*:",
                "Name of consumer(s):",
                "Address of consumer(s):",
                "Signature of consumer(s) (only if this form is sent on paper):",
                "Date:",
              ],
            },
            { type: "paragraph", text: "*Delete as appropriate." },
          ],
        },
      ],
    },
  ],
};
