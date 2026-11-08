import type { LegalPolicyDocument } from "../policy/policy-document.js";

/**
 * AML, Identity and Sanctions Checks Notice, as published by London Art Exchange Ltd at https://www.thelax.art/aml-identity-checks
 * (version 1.0, effective 2026-08-12). Business-team text: keep the wording and clause numbers.
 */
export const AML_IDENTITY_CHECKS_POLICY: LegalPolicyDocument<"aml-identity-checks"> = {
  slug: "aml-identity-checks",
  title: "AML, Identity and Sanctions Checks Notice",
  summary:
    "Identity, anti-money-laundering and sanctions checks, and the thresholds at which they apply.",
  sections: [
    {
      id: "why-checks-may-be-required",
      heading: "1. Why checks may be required",
      blocks: [
        {
          type: "paragraph",
          text: "London Art Exchange Ltd may be an Art Market Participant for a transaction or linked transactions involving works of art at or above £10,000, including relevant tax, commission and ancillary invoice costs. We also conduct proportionate checks to prevent fraud and comply with sanctions and other law.",
        },
      ],
    },
    {
      id: "what-we-may-request",
      heading: "2. What we may request",
      blocks: [
        {
          type: "paragraph",
          text: "We may request proof of identity and address; company, trust and beneficial-owner information; authority to act; payer and recipient details; and evidence concerning source of funds, source of wealth or transaction purpose. Requirements depend on risk and legal duties.",
        },
      ],
    },
    {
      id: "timing-and-transaction-effects",
      heading: "3. Timing and transaction effects",
      blocks: [
        {
          type: "paragraph",
          text: "Checks may occur before acceptance, before receipt or release of money, before a refund and before dispatch or collection. A transaction may be paused, refused or terminated if it cannot lawfully proceed. Money or property is not forfeited merely because a check is requested; any freeze, withholding or deduction must have a legal or contractual basis.",
        },
      ],
    },
    {
      id: "sanctions",
      heading: "4. Sanctions",
      blocks: [
        {
          type: "paragraph",
          text: "We screen relevant persons, ownership and control against the current UK Sanctions List and use other risk information where appropriate. We may be required to freeze funds or economic resources and report to OFSI. AML suspicion reporting to the NCA is a separate duty.",
        },
      ],
    },
    {
      id: "confidentiality-and-privacy",
      heading: "5. Confidentiality and privacy",
      blocks: [
        {
          type: "paragraph",
          text: "Law may prevent us from telling a person whether a suspicious activity report has been made or why a step was taken. We use and retain personal information as explained in the Privacy Notice and applicable AML law, normally retaining required CDD and transaction records for five years from the relevant trigger.",
        },
      ],
    },
    {
      id: "contact",
      heading: "6. Contact",
      blocks: [
        {
          type: "paragraph",
          text: "Questions about identity checks may be sent to info@thelax.art. Do not email passports, bank statements or other sensitive documents. We will provide secure upload or verified in-person instructions when documents are required.",
        },
      ],
    },
  ],
} as const;
