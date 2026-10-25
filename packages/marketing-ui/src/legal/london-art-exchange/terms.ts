import type { LegalPolicyDocument } from "../policy/policy-document.js";

/**
 * Website and Gallery Sale Terms, as published by London Art Exchange Ltd at https://www.thelax.art/terms-of-sale
 * (version 1.0, effective 2026-08-12). Business-team text: keep the wording and clause numbers.
 */
export const TERMS_POLICY: LegalPolicyDocument<"terms"> = {
  slug: "terms",
  title: "Website and Gallery Sale Terms",
  summary:
    "Website and Gallery Sale Terms — how a contract is formed, pricing, delivery, title and your statutory rights.",
  sections: [
    {
      id: "who-we-are-and-how-to-contact-us",
      heading: "1. Who we are and how to contact us",
      blocks: [
        {
          type: "paragraph",
          text: "1.1 The website at www.thelax.art (the Website) is operated by London Art Exchange Ltd, trading as London Art Exchange (LAX, we, us or our). We are registered in England and Wales under company number 12874213. Our registered office is London Art Exchange, 156 New Cavendish Street, London, United Kingdom, W1W 6YW.",
        },
        {
          type: "paragraph",
          text: "1.2 Prices shown to Consumers include VAT where it applies. Any VAT invoice will contain the details required by law.",
        },
        {
          type: "paragraph",
          text: "1.3 You can contact us:",
        },
        {
          type: "list",
          items: [
            "by email at info@thelax.art;",
            "by telephone at +44 20 8044 1334; or",
            "by post at the registered office above, marked for the attention of Customer Services.",
          ],
        },
        {
          type: "paragraph",
          text: "1.4 Our current gallery or trading locations, opening hours and accessibility information appear on the Contact page. A gallery address is not our registered office unless expressly labelled as such.",
        },
      ],
    },
    {
      id: "scope-of-these-terms",
      heading: "2. Scope of these Terms",
      blocks: [
        {
          type: "paragraph",
          text: "2.1 These Terms govern:",
        },
        {
          type: "list",
          items: [
            "your use of the Website; and",
            "direct sales of physical artworks and related physical items where the product page, order summary and invoice identify London Art Exchange Ltd as the seller.",
          ],
        },
        {
          type: "paragraph",
          text: "2.2 These Terms do not govern an auction, a sale in which we act only as an agent for another seller, a consignment to us, a managed-resale service, a credit arrangement, a storage service, a royalty or revenue arrangement, or a bespoke business-to-business service. Those activities require separate terms which must identify the contracting parties and take priority for that transaction.",
        },
        {
          type: "paragraph",
          text: "2.3 A link from this Website to an auction or another platform does not make that platform part of this Website. Before using it, check the operator’s legal name, fees, privacy notice and transaction terms. We do not accept an auction bid or auction contract under these Terms.",
        },
        {
          type: "paragraph",
          text: "2.4 If you are buying wholly or mainly for purposes outside your trade, business, craft or profession, you are a Consumer. If not, you are a Business Customer. These public Terms are designed principally for Consumers. We may require a Business Customer to sign separate B2B terms before accepting an order. Nothing in a B2B clause applies so as to remove a Consumer’s mandatory rights.",
        },
      ],
    },
    {
      id: "important-collecting-and-value-statement",
      heading: "3. Important collecting and value statement",
      blocks: [
        {
          type: "paragraph",
          text: "3.1 We sell physical artworks and provide art-related guidance. An artwork is not a regulated savings product and its future market value is uncertain.",
        },
        {
          type: "paragraph",
          text: "3.2 We do not promise future value, appreciation, resale, liquidity, income or financial return. Historic prices, third-party estimates and market commentary are not forecasts. Any objective claim that we publish must have documented support, and a qualification does not override a contradictory headline, chart or sales statement.",
        },
        {
          type: "paragraph",
          text: "3.3 You should buy an artwork because it is suitable for your own collecting objectives and circumstances. Obtain independent legal, tax, conservation or financial advice where appropriate. Nothing we say is a personal investment recommendation.",
        },
      ],
    },
    {
      id: "artwork-information-and-evidence",
      heading: "4. Artwork information and evidence",
      blocks: [
        {
          type: "paragraph",
          text: "4.1 Before you order, the product page and any agreed condition report will identify, where applicable:",
        },
        {
          type: "list",
          items: [
            "the artist, title, date or period;",
            "whether the item is an original work, print, reproduction, edition or other object;",
            "medium, support, dimensions and whether dimensions include the frame;",
            "edition size and number, signature or inscriptions;",
            "framing, glazing and included certificate or documentation;",
            "material condition, restoration or known defects;",
            "provenance and authentication information that we are entitled to disclose;",
            "whether attribution, date, provenance or authenticity is qualified;",
            "seller identity, availability, total price, tax and mandatory charges; and",
            "relevant export, cultural-property, CITES, ivory or other restrictions known to us.",
          ],
        },
        {
          type: "paragraph",
          text: "4.2 Images are intended to represent the work, but screens, lighting and scale can affect appearance. This does not permit a material difference from the description. Ask for additional images, a video viewing or an appointment if colour, texture, condition or scale is important to your decision.",
        },
        {
          type: "paragraph",
          text: "4.3 A condition report describes matters reasonably visible at the inspection date. Unless expressly commissioned as such, it is not a full scientific or conservation report. Its factual statements form part of the information on which you may rely and cannot be excluded where the law makes them binding.",
        },
        {
          type: "paragraph",
          text: "4.4 Statements of authorship, attribution, period, provenance and authenticity will be stated as facts only where our records support that presentation. A genuine opinion or qualification will be labelled clearly. We do not use phrases such as “as is”, “opinion only” or “buyer must inspect” to exclude liability for a false description or non-conforming goods.",
        },
        {
          type: "paragraph",
          text: "4.5 You must tell us before ordering if you require the work for a particular purpose, installation method, environmental condition or location. We will tell you whether we accept that requirement as part of the contract.",
        },
      ],
    },
    {
      id: "availability-and-unique-works",
      heading: "5. Availability and unique works",
      blocks: [
        {
          type: "paragraph",
          text: "5.1 Many artworks are unique or have limited editions. Displaying an item does not guarantee that it remains available.",
        },
        {
          type: "paragraph",
          text: "5.2 Our checkout should reserve stock while payment is completed, but a contract is not formed until acceptance under clause 7. If the same work is genuinely sold before we accept your order, we will not substitute another work without your agreement. We will cancel the request and refund any amount taken promptly.",
        },
        {
          type: "paragraph",
          text: "5.3 We will not use false scarcity, fabricated waiting lists, misleading countdown timers or an unjustified “sold” label.",
        },
      ],
    },
    {
      id: "prices-tax-and-charges",
      heading: "6. Prices, tax and charges",
      blocks: [
        {
          type: "paragraph",
          text: "6.1 Before you are bound, we will show the total price payable, including VAT where applicable and every unavoidable commission, administration fee or other mandatory charge. We will also show the delivery charge or, where it cannot reasonably be calculated in advance, how it is calculated and any reasonable estimate required by law.",
        },
        {
          type: "paragraph",
          text: "6.2 We do not add a Consumer payment-method surcharge that the law prohibits.",
        },
        {
          type: "paragraph",
          text: "6.3 If Artist’s Resale Right or another royalty applies, the product page and order summary will state the amount or calculation and who bears it under the contract. We will not add it after checkout if it was an unavoidable charge that should have been included beforehand.",
        },
        {
          type: "paragraph",
          text: "6.4 International buyers may owe import VAT, customs duty, brokerage or destination charges. We will state before contracting whether those sums are included and who is responsible. This does not alter any mandatory consumer right or our duty to describe the total price as far as it can reasonably be calculated.",
        },
        {
          type: "paragraph",
          text: "6.5 If a price is an obvious error that you knew or should reasonably have known was an error, we will contact you before fulfilment. We will ask whether you wish to proceed at the correct price or cancel for a full refund, subject always to any legal obligation to honour the accepted contract.",
        },
      ],
    },
    {
      id: "how-the-contract-is-formed",
      heading: "7. How the contract is formed",
      blocks: [
        {
          type: "paragraph",
          text: "7.1 The checkout will let you review and correct your details and order before submission. The final button will state “Order and pay” or equally clear wording showing that payment is required.",
        },
        {
          type: "paragraph",
          text: "7.2 Your order is an offer to buy. An automated acknowledgement confirms receipt but does not by itself accept the order.",
        },
        {
          type: "paragraph",
          text: "7.3 We accept your order and a contract is formed when we send an express order-acceptance or dispatch confirmation, whichever occurs first, unless the checkout clearly states and records a different lawful acceptance point.",
        },
        {
          type: "paragraph",
          text: "7.4 The contract is in English. We will provide a durable copy of the applicable Terms, cancellation information, product description, total price and order details by email no later than delivery. We retain the contract and acceptance record in accordance with our Privacy Notice and legal retention duties.",
        },
        {
          type: "paragraph",
          text: "7.5 No sales representative may change the written contract unless the change is recorded in writing by an authorised representative and does not remove a mandatory right.",
        },
      ],
    },
    {
      id: "payment-and-fraud-prevention",
      heading: "8. Payment and fraud prevention",
      blocks: [
        {
          type: "paragraph",
          text: "8.1 We accept the payment methods shown at checkout. Payment is due as displayed before you order. We do not store full card details where payment is handled by a compliant payment provider.",
        },
        {
          type: "paragraph",
          text: "8.2 A deposit or reservation payment is refundable unless a separate, fair and prominent written term agreed before payment explains a lawful deduction. We will not describe every deposit as automatically non-refundable.",
        },
        {
          type: "paragraph",
          text: "8.3 We may use proportionate fraud-prevention and payment-verification checks. If a check fails before acceptance, we may decline the order and release or refund funds. If we have accepted the contract, any suspension or termination must comply with the contract and law.",
        },
      ],
    },
    {
      id: "identity-aml-and-sanctions-checks",
      heading: "9. Identity, AML and sanctions checks",
      blocks: [
        {
          type: "paragraph",
          text: "9.1 Art-market law may require us to identify and verify a buyer, seller, payer, payee, beneficial owner, company, trust, representative or recipient; understand the transaction; establish source of funds or source of wealth; and conduct sanctions, politically exposed person and adverse-information checks.",
        },
        {
          type: "paragraph",
          text: "9.2 From 30 June 2026, the UK Art Market Participant threshold is £10,000, including qualifying linked transactions and relevant taxes, commission and ancillary invoice costs. We may conduct risk-based checks below that amount.",
        },
        {
          type: "paragraph",
          text: "9.3 You must provide accurate information and documents reasonably required for a lawful check. We may pause acceptance, payment release, refund or dispatch where the law requires or permits this, but we will not treat the pause as a right to confiscate your money or property.",
        },
        {
          type: "paragraph",
          text: "9.4 We may refuse or terminate a transaction where we cannot lawfully complete it, refund money where lawful, freeze funds or property where required, and make a report to HMRC, the National Crime Agency, OFSI or another authority. The law may prevent us from explaining a decision or report.",
        },
        {
          type: "paragraph",
          text: "9.5 More information appears in the AML, Identity and Sanctions Checks Notice and Privacy Notice.",
        },
      ],
    },
    {
      id: "delivery",
      heading: "10. Delivery",
      blocks: [
        {
          type: "paragraph",
          text: "10.1 The product page or order summary will state the delivery destination, method, charge and estimated or agreed date. Unless we agree another period with a Consumer, we will deliver without undue delay and no later than 30 days after the contract is made.",
        },
        {
          type: "paragraph",
          text: "10.2 If we arrange the carrier for a Consumer, risk of loss or damage remains with us until the Consumer or a person identified by the Consumer takes physical possession. Optional insurance wording does not transfer that statutory risk.",
        },
        {
          type: "paragraph",
          text: "10.3 If a Consumer independently instructs a carrier that we did not offer, risk may pass when the work is delivered to that carrier, as the law provides.",
        },
        {
          type: "paragraph",
          text: "10.4 Title to the physical artwork transfers when we have received cleared payment in full, subject to any mandatory law. Copyright and reproduction rights do not transfer under clause 15.",
        },
        {
          type: "paragraph",
          text: "10.5 Inspect the packaging and artwork reasonably soon after arrival and keep the packaging if damage is suspected. Prompt photographs help a carrier claim, but failure to report within an arbitrary short period does not remove a Consumer’s statutory rights.",
        },
        {
          type: "paragraph",
          text: "10.6 The detailed Shipping, Delivery, Collection and Storage Policy forms part of these Terms.",
        },
      ],
    },
    {
      id: "consumer-cancellation-for-distance-sales",
      heading: "11. Consumer cancellation for distance sales",
      blocks: [
        {
          type: "paragraph",
          text: "11.1 If you are a Consumer who buys online, by telephone or away from our business premises, you normally have 14 days to cancel without giving a reason. For a single artwork, the period ends 14 days after you or a person you nominate takes physical possession. Special rules apply to split deliveries.",
        },
        {
          type: "paragraph",
          text: "11.2 To cancel, send a clear statement to the contact details in clause 1 before the period ends. You may use the model cancellation form, but you do not have to.",
        },
        {
          type: "paragraph",
          text: "11.3 After telling us, return the work without undue delay and no later than 14 days after cancellation. Follow the safe-return instructions in the Returns and Cancellation Policy.",
        },
        {
          type: "paragraph",
          text: "11.4 If we told you before contracting that you must pay the direct return cost, you must do so. For a work that cannot normally be returned by post, the product page or checkout must disclose the return cost or a reasonable maximum estimate. We pay return costs where the work is faulty, damaged, misdescribed or otherwise non-conforming.",
        },
        {
          type: "paragraph",
          text: "11.5 We refund the price and the least expensive standard outbound delivery charge we offered. We may withhold the refund until we receive the work or evidence that it was sent back, whichever occurs first. We will refund within 14 days of that point, using the original method unless you expressly agree otherwise.",
        },
        {
          type: "paragraph",
          text: "11.6 We may make a reasonable deduction for diminished value caused by handling beyond what would be permitted when examining the work in a gallery. Opening packaging and reasonably inspecting the item does not automatically remove the right to cancel.",
        },
        {
          type: "paragraph",
          text: "11.7 The change-of-mind right may not apply to a work made to your specifications or clearly personalised. The exception is applied narrowly and will be disclosed before the order. It does not apply merely because a standard frame was selected, a stock work was reserved, or an ordinary certificate was prepared. It never removes rights for faulty, damaged, late or misdescribed goods.",
        },
        {
          type: "paragraph",
          text: "11.8 There is no automatic change-of-mind cancellation right for an ordinary purchase completed in a gallery, unless our written in-gallery returns promise says otherwise. Statutory rights remain.",
        },
      ],
    },
    {
      id: "faulty-damaged-or-misdescribed-goods",
      heading: "12. Faulty, damaged or misdescribed goods",
      blocks: [
        {
          type: "paragraph",
          text: "12.1 Nothing in these Terms limits your statutory rights. For a Consumer, goods must be of satisfactory quality, fit for a purpose we accepted and as described, and must match binding pre-contract information, samples or models.",
        },
        {
          type: "paragraph",
          text: "12.2 Depending on the circumstances, Consumer remedies may include the 30-day short-term right to reject, repair or replacement where appropriate, a price reduction, or the final right to reject. A unique artwork may make repair or replacement impossible; that does not remove the other remedies.",
        },
        {
          type: "paragraph",
          text: "12.3 Contact us promptly with your order number and useful photographs if an artwork arrives damaged. We will arrange and pay for an appropriate return or collection where the work is non-conforming. A reporting request is not a waiver deadline.",
        },
        {
          type: "paragraph",
          text: "12.4 A statement that attribution or provenance is qualified does not excuse a description that is false or misleading. If a work was sold as being by a named artist and is shown not to conform to that description, your statutory and contractual remedies apply.",
        },
      ],
    },
    {
      id: "authenticity-attribution-and-provenance-concerns",
      heading: "13. Authenticity, attribution and provenance concerns",
      blocks: [
        {
          type: "paragraph",
          text: "13.1 If you have a material concern, contact us with the order details, the basis of the concern and available evidence. Do not undertake invasive testing, restoration or alteration before giving us a reasonable opportunity to inspect, unless urgent conservation is reasonably necessary.",
        },
        {
          type: "paragraph",
          text: "13.2 We may obtain an independent expert opinion at our cost where proportionate. We will not require two experts, impose an arbitrary 21-day authenticity deadline, or refuse a valid claim merely because the work was reframed, cleaned or resold. We may consider whether later alteration caused or prevents reliable assessment.",
        },
        {
          type: "paragraph",
          text: "13.3 Any separate authenticity guarantee must be written, prominent and additional to statutory rights. It may define eligible claims and evidence, but it cannot exclude liability for a false description, fraud, defective title or other non-excludable matter.",
        },
      ],
    },
    {
      id: "care-framing-installation-and-conservation",
      heading: "14. Care, framing, installation and conservation",
      blocks: [
        {
          type: "paragraph",
          text: "14.1 Advice about hanging, light, humidity, glazing, framing, handling or conservation is general unless we agree a professional service in writing.",
        },
        {
          type: "paragraph",
          text: "14.2 Follow any supplied care instructions and use a suitably qualified installer or conservator. We are responsible for loss that the law attributes to our breach or negligence, but not for damage caused after delivery by misuse, unsuitable conditions or an unauthorised intervention.",
        },
      ],
    },
    {
      id: "physical-ownership-and-intellectual-property",
      heading: "15. Physical ownership and intellectual property",
      blocks: [
        {
          type: "paragraph",
          text: "15.1 Buying the physical artwork does not transfer copyright, design rights, moral rights, trade marks, image rights or commercial reproduction rights unless a separate written and signed assignment or licence expressly says so.",
        },
        {
          type: "paragraph",
          text: "15.2 You may display the work privately and exercise rights allowed by law. You must not reproduce, merchandise, mint, tokenise, commercially publish or exploit the artwork or our catalogue images without the relevant rights holder’s permission.",
        },
        {
          type: "paragraph",
          text: "15.3 Website text, photographs, videos, graphics, marks and software are owned by us or licensed to us. You may view and make a private copy necessary to use the Website, but may not scrape, republish, remove rights information or use the material commercially without permission or another lawful basis.",
        },
      ],
    },
    {
      id: "export-cultural-property-and-restricted-materials",
      heading: "16. Export, cultural property and restricted materials",
      blocks: [
        {
          type: "paragraph",
          text: "16.1 An export licence, sanctions approval, CITES permit, ivory exemption or other authorisation may be required. We will provide material information known to us, but you must cooperate with destination and importer requirements allocated to you before the contract.",
        },
        {
          type: "paragraph",
          text: "16.2 We may delay dispatch while a required licence or check is pending. If authorisation is finally refused, we will apply the contract and law fairly, including refunding sums for goods that cannot lawfully be supplied, less only a lawful, disclosed cost attributable to your breach where applicable.",
        },
        {
          type: "paragraph",
          text: "16.3 We do not knowingly deal dishonestly in tainted cultural objects. We may withdraw a listing or notify authorities where title, provenance, illicit excavation, export or sanctions concerns arise.",
        },
      ],
    },
    {
      id: "storage-and-uncollected-works",
      heading: "17. Storage and uncollected works",
      blocks: [
        {
          type: "paragraph",
          text: "17.1 Collection dates, free storage periods and any storage charge must be stated before the contract or agreed later in writing. Charges must be reasonable and reflect the service provided.",
        },
        {
          type: "paragraph",
          text: "17.2 If you fail to collect or accept delivery, we will give reasonable written notice and an opportunity to arrange delivery or collection. We will not sell, dispose of or exercise a lien over a Consumer’s work without a lawful basis, fair procedure and any notice required by law.",
        },
        {
          type: "paragraph",
          text: "17.3 Long-term storage, third-party warehousing and storage insurance require a separate written storage agreement.",
        },
      ],
    },
    {
      id: "accounts-and-acceptable-use",
      heading: "18. Accounts and acceptable use",
      blocks: [
        {
          type: "paragraph",
          text: "18.1 Keep account credentials confidential and tell us promptly if you suspect unauthorised use. We may require a password reset or suspend an account to protect the user or Website.",
        },
        {
          type: "paragraph",
          text: "18.2 You must not misuse the Website, introduce malicious code, attempt unauthorised access, interfere with checkout, scrape contrary to law or rights, impersonate another person, or submit unlawful, fraudulent, infringing or abusive material.",
        },
        {
          type: "paragraph",
          text: "18.3 We may remove unlawful content or suspend access proportionately. Suspension does not remove rights under an existing sale contract.",
        },
      ],
    },
    {
      id: "website-availability-and-third-party-services",
      heading: "19. Website availability and third-party services",
      blocks: [
        {
          type: "paragraph",
          text: "19.1 We use reasonable care to keep the Website available and secure but do not promise uninterrupted operation. Maintenance, security incidents or events outside reasonable control may cause interruption.",
        },
        {
          type: "paragraph",
          text: "19.2 Links to independent sites are provided for convenience. We are not responsible for their content or contracts, but this does not exclude responsibility where the law treats a representation, integration or service as ours.",
        },
      ],
    },
    {
      id: "liability-to-consumers",
      heading: "20. Liability to Consumers",
      blocks: [
        {
          type: "paragraph",
          text: "20.1 Nothing excludes or limits liability where it would be unlawful, including liability for death or personal injury caused by negligence, fraud or fraudulent misrepresentation, defective title, or breach of mandatory consumer rights.",
        },
        {
          type: "paragraph",
          text: "20.2 If you are a Consumer, we are responsible for loss or damage that is a foreseeable result of our breach or failure to use reasonable care. We are not responsible for a loss that was not foreseeable when the contract was made.",
        },
        {
          type: "paragraph",
          text: "20.3 We supply to Consumers for private use. We are not responsible under a Consumer contract for business losses such as lost profit, revenue, opportunity or business interruption.",
        },
        {
          type: "paragraph",
          text: "20.4 Nothing in this clause shifts delivery risk before physical possession or limits a statutory remedy for non-conforming goods.",
        },
      ],
    },
    {
      id: "business-customers",
      heading: "21. Business Customers",
      blocks: [
        {
          type: "paragraph",
          text: "21.1 A Business Customer must sign or accept separate B2B terms where we require them. If no separate B2B terms exist, these Terms apply only to the extent relevant, but clauses stated specifically for Consumers do not create equivalent business rights.",
        },
        {
          type: "paragraph",
          text: "21.2 For a Business Customer, our total aggregate liability arising from the relevant transaction will not exceed the total price paid or payable for that transaction. Neither party is liable for indirect or consequential loss, loss of profit, revenue, anticipated savings, business, opportunity or goodwill. These limits do not apply to payment obligations, fraud or fraudulent misrepresentation, death or personal injury caused by negligence, breach of title, deliberate default, or any liability that cannot lawfully be limited. Nothing in this clause affects a Consumer's rights.",
        },
      ],
    },
    {
      id: "events-outside-reasonable-control",
      heading: "22. Events outside reasonable control",
      blocks: [
        {
          type: "paragraph",
          text: "22.1 Neither party is responsible for delay caused by an event outside its reasonable control, provided it takes reasonable steps to reduce the effect and tells the other party promptly.",
        },
        {
          type: "paragraph",
          text: "22.2 This clause does not require a Consumer to wait indefinitely. Statutory delivery and cancellation remedies continue to apply.",
        },
      ],
    },
    {
      id: "complaints-and-adr",
      heading: "23. Complaints and ADR",
      blocks: [
        {
          type: "paragraph",
          text: "23.1 Please use the Complaints and ADR Policy. We will investigate fairly and will not disadvantage you for making a complaint or exercising a right.",
        },
        {
          type: "paragraph",
          text: "23.2 After our final response, we will tell a Consumer about any suitable accredited alternative dispute resolution provider that applies and whether we agree or are required to use it. We do not claim membership of a scheme unless that is true. The former EU Online Dispute Resolution platform is not our route.",
        },
      ],
    },
    {
      id: "changes-to-these-terms",
      heading: "24. Changes to these Terms",
      blocks: [
        {
          type: "paragraph",
          text: "24.1 The Terms that apply to a sale are those accepted when you ordered. We may update Website-use provisions for legal, security or operational reasons, but will not retrospectively change an existing sale contract without agreement or a lawful basis.",
        },
        {
          type: "paragraph",
          text: "24.2 We keep dated previous versions and a change log.",
        },
      ],
    },
    {
      id: "general-terms",
      heading: "25. General terms",
      blocks: [
        {
          type: "paragraph",
          text: "25.1 If a court finds part of these Terms unlawful, the rest continues in effect.",
        },
        {
          type: "paragraph",
          text: "25.2 A delay in enforcing a right is not a waiver.",
        },
        {
          type: "paragraph",
          text: "25.3 We may transfer our rights or obligations only where this does not reduce a Consumer’s protections. You may transfer a Consumer right where the law permits.",
        },
        {
          type: "paragraph",
          text: "25.4 No person other than the parties has a right to enforce these Terms under the Contracts (Rights of Third Parties) Act 1999, except where a term expressly says otherwise.",
        },
        {
          type: "paragraph",
          text: "25.5 If there is a conflict, an individually agreed written term takes priority, then the order confirmation, then these Terms, then the other public policies, without excluding mandatory rights.",
        },
      ],
    },
    {
      id: "governing-law-and-courts",
      heading: "26. Governing law and courts",
      blocks: [
        {
          type: "paragraph",
          text: "26.1 English law governs these Terms.",
        },
        {
          type: "paragraph",
          text: "26.2 A Consumer resident in another part of the United Kingdom or another country keeps any mandatory protections and court rights that cannot lawfully be excluded. A Consumer may bring proceedings in the courts permitted by applicable consumer law.",
        },
        {
          type: "paragraph",
          text: "26.3 Subject to clause 26.2, the courts of England and Wales have jurisdiction.",
        },
      ],
    },
  ],
} as const;
