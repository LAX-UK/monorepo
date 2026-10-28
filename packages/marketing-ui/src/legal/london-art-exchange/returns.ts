import type { LegalPolicyDocument } from "../policy/policy-document.js";

/**
 * Returns and Cancellation Policy, as published by London Art Exchange Ltd at https://www.thelax.art/returns-cancellation
 * (version 1.0, effective 2026-08-12). Business-team text: keep the wording and clause numbers.
 */
export const RETURNS_POLICY: LegalPolicyDocument<"returns"> = {
  slug: "returns",
  title: "Returns and Cancellation Policy",
  summary:
    "The 14-day distance cancellation right, safe-return requirements and the model cancellation form.",
  sections: [
    {
      id: "what-this-policy-covers",
      heading: "1. What this policy covers",
      blocks: [
        {
          type: "paragraph",
          text: "This policy applies to direct purchases of physical goods from London Art Exchange Ltd under the Website and Gallery Sale Terms. It separates a statutory distance-sale cancellation from remedies for faulty, damaged or misdescribed goods. It does not apply to an auction or a third-party sale governed by separate terms.",
        },
      ],
    },
    {
      id: "online-telephone-and-off-premises-purchases",
      heading: "2. Online, telephone and off-premises purchases",
      blocks: [
        {
          type: "paragraph",
          text: "2.1 A Consumer may normally cancel without giving a reason during the 14 days after taking physical possession of the artwork. The period does not start on payment, invoice, certification, DocuSign, dispatch or order acceptance.",
        },
        {
          type: "paragraph",
          text: "2.2 For multiple goods delivered separately, the applicable statutory timing will be calculated under the Consumer Contracts Regulations. The order email will state the relevant position.",
        },
        {
          type: "paragraph",
          text: "2.3 Tell us before the deadline by a clear statement sent to info@lax.art, by post to the registered office, or by another contact method we state. A reason is optional. You may use the model form below.",
        },
        {
          type: "paragraph",
          text: "2.4 Return the work without undue delay and no later than 14 days after telling us. Contact us first so that a unique or fragile work can be packed, insured and routed safely.",
        },
        {
          type: "paragraph",
          text: "2.5 You pay the direct cost of a change-of-mind return only where that responsibility and the cost were disclosed before contracting. A standard item that can be safely returned by an ordinary tracked service may be returned at the actual carrier cost. A framed, glazed, sculptural, oversized or high-value work must use the specialist collection method and cost or reasonable maximum estimate shown on the product page or checkout. If we did not provide that required cost information before the order, we will bear the direct return cost.",
        },
        {
          type: "paragraph",
          text: "2.6 We refund the price plus the least expensive standard outbound delivery we offered. We need not refund the extra cost of an upgraded delivery chosen by you. We refund within 14 days after receiving the work or evidence of dispatch, whichever occurs first, and may withhold the refund until that point. We use the original payment method unless you expressly agree otherwise, and we do not charge a refund fee.",
        },
        {
          type: "paragraph",
          text: "2.7 You may inspect the work as you could in a gallery. We may deduct only a reasonable amount for diminished value caused by handling beyond that. A missing certificate, damaged frame or alteration will be assessed on actual effect and does not automatically cancel every right.",
        },
      ],
    },
    {
      id: "exceptions",
      heading: "3. Exceptions",
      blocks: [
        {
          type: "paragraph",
          text: "3.1 The change-of-mind right may not apply to a work made to your specifications or clearly personalised, where the statutory exception applies and was disclosed before order.",
        },
        {
          type: "paragraph",
          text: "3.2 The exception does not apply merely because:",
        },
        {
          type: "list",
          items: [
            "an available stock work was reserved;",
            "a standard frame or ordinary delivery option was chosen;",
            "the work is unique but was not made to your specification; or",
            "a certificate or invoice was prepared in the ordinary way.",
          ],
        },
        {
          type: "paragraph",
          text: "3.3 No exception removes rights where goods are faulty, damaged, late, misdescribed or otherwise non-conforming.",
        },
      ],
    },
    {
      id: "in-gallery-purchases",
      heading: "4. In-gallery purchases",
      blocks: [
        {
          type: "paragraph",
          text: "There is no automatic statutory change-of-mind right for an ordinary purchase completed at our gallery. Any additional in-gallery exchange or returns promise will be stated on the receipt. Statutory remedies still apply.",
        },
      ],
    },
    {
      id: "faulty-damaged-or-misdescribed-goods",
      heading: "5. Faulty, damaged or misdescribed goods",
      blocks: [
        {
          type: "paragraph",
          text: "5.1 Contact us with the order number, description and useful photographs. We will not require a reason where you are exercising the distance-cancellation right, but details help us resolve a quality or delivery claim.",
        },
        {
          type: "paragraph",
          text: "5.2 Where goods do not conform to the contract, we pay reasonable return or collection costs and provide the remedy required by law. This may include rejection and refund, repair or replacement where appropriate, price reduction or final rejection.",
        },
        {
          type: "paragraph",
          text: "5.3 A request to report transit damage promptly assists evidence and insurance but is not a contractual time bar on statutory rights.",
        },
      ],
    },
    {
      id: "safe-return-requirements",
      heading: "6. Safe return requirements",
      blocks: [
        {
          type: "paragraph",
          text: "6.1 Use the original specialist packaging where reasonably possible. If it is unsuitable or unavailable, ask us for instructions. Do not use an ordinary parcel service for a work that requires specialist art transport.",
        },
        {
          type: "paragraph",
          text: "6.2 A Consumer remains responsible for reasonable care while the work is in their possession. We do not impose “perfect condition” as a blanket condition of cancellation; any deduction must reflect legally permitted diminished value.",
        },
        {
          type: "paragraph",
          text: "6.3 Send tracking or collection evidence. We will confirm receipt and inspect promptly.",
        },
      ],
    },
    {
      id: "model-cancellation-form",
      heading: "7. Model cancellation form",
      blocks: [
        {
          type: "paragraph",
          text: "Complete and return this form only if you wish to cancel. A clear email containing the same information is sufficient.",
        },
        {
          type: "paragraph",
          text: "To: London Art Exchange Ltd, London Art Exchange, 156 New Cavendish Street, London, United Kingdom, W1W 6YW; email: info@lax.art",
        },
        {
          type: "paragraph",
          text: "I/We hereby give notice that I/We cancel my/our contract for the sale of the following goods:",
        },
        {
          type: "paragraph",
          text: "Artwork/order: _______________________________________________",
        },
        {
          type: "paragraph",
          text: "Ordered on / received on: ____________________________________",
        },
        {
          type: "paragraph",
          text: "Consumer name: ______________________________________________",
        },
        {
          type: "paragraph",
          text: "Consumer address: ____________________________________________",
        },
        {
          type: "paragraph",
          text: "Order number: ________________________________________________",
        },
        {
          type: "paragraph",
          text: "Signature (only if submitted on paper): _______________________",
        },
        {
          type: "paragraph",
          text: "Date: ________________________________________________________",
        },
      ],
    },
  ],
} as const;
