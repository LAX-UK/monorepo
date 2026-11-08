import type { LegalPolicyDocument } from "../policy/policy-document.js";

/**
 * Voluntary Ethical Sourcing Statement, as published by London Art Exchange Ltd at https://www.thelax.art/ethical-sourcing
 * (version 1.0, effective 2026-08-12). Business-team text: keep the wording and clause numbers.
 */
export const ETHICAL_SOURCING_POLICY: LegalPolicyDocument<"ethical-sourcing"> = {
  slug: "ethical-sourcing",
  title: "Voluntary Ethical Sourcing Statement",
  summary: "Our voluntary commitments on provenance, cultural property and restricted materials.",
  sections: [
    {
      id: "our-position",
      heading: "1. Our position",
      blocks: [
        {
          type: "paragraph",
          text: "This is a voluntary ethical-sourcing statement. It is not presented as a statutory statement under section 54 of the Modern Slavery Act 2015.",
        },
        {
          type: "paragraph",
          text: "London Art Exchange Ltd opposes slavery, servitude, forced or compulsory labour and human trafficking. We expect employees, contractors and suppliers to comply with applicable labour, human-rights, anti-bribery, sanctions and criminal law.",
        },
      ],
    },
    {
      id: "supply-relationships-and-checks",
      heading: "2. Supply relationships and checks",
      blocks: [
        {
          type: "paragraph",
          text: "Our supply relationships may include artists, collectors, consignors, carriers, framers, installers, storage providers, technology providers and professional advisers in the United Kingdom and overseas.",
        },
        {
          type: "paragraph",
          text: "We apply proportionate checks based on the supplier, location, service, transaction value and information available. Where a concern arises, we may request evidence, pause onboarding or performance, require corrective action, change supplier or report a matter where legally required.",
        },
        {
          type: "paragraph",
          text: "Contracts and purchase arrangements should identify the parties, lawful ownership or authority, service standards, payment route and relevant compliance duties. We do not knowingly continue a relationship where credible evidence of forced labour or trafficking remains unresolved.",
        },
      ],
    },
    {
      id: "reporting-concerns",
      heading: "3. Reporting concerns",
      blocks: [
        {
          type: "paragraph",
          text: "A concern about our operations or supply relationships may be reported to info@thelax.art or by post to the registered office, marked Confidential - Ethical Sourcing.",
        },
        {
          type: "paragraph",
          text: "We will assess a report proportionately, limit disclosure to those who need it and will not knowingly penalise a person for raising a genuine concern in good faith.",
        },
      ],
    },
    {
      id: "review",
      heading: "4. Review",
      blocks: [
        {
          type: "paragraph",
          text: "We review this statement at least annually and after a material change to our operations or supply network.",
        },
        {
          type: "paragraph",
          text: "We will update the statement if our legal reporting status changes or if we introduce material new controls that can be accurately described.",
        },
      ],
    },
  ],
} as const;
