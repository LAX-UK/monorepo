import type { LegalPolicyDocument } from "../policy/policy-document.js";

/**
 * Complaints and ADR Policy, as published by London Art Exchange Ltd at https://www.thelax.art/complaints-adr
 * (version 1.0, effective 2026-08-12). Business-team text: keep the wording and clause numbers.
 */
export const COMPLAINTS_POLICY: LegalPolicyDocument<"complaints"> = {
  slug: "complaints",
  title: "Complaints and ADR Policy",
  summary:
    "How to raise a concern, how we investigate, and the alternative dispute resolution routes available to you.",
  sections: [
    {
      id: "how-to-complain",
      heading: "1. How to complain",
      blocks: [
        {
          type: "paragraph",
          text: "Contact Customer Services at info@thelax.art, by telephone on +44 800 208 4800, or by post to the registered office. Include your name, contact details, order number if relevant, what happened and the outcome you seek. We will make reasonable adjustments and accept an authorised representative.",
        },
      ],
    },
    {
      id: "what-we-will-do",
      heading: "2. What we will do",
      blocks: [
        {
          type: "paragraph",
          text: "2.1 We will acknowledge a customer complaint within five business days and aim to issue a reasoned final response within 20 business days. If a matter needs longer, we will explain why, identify the next step and provide an updated date.",
        },
        {
          type: "paragraph",
          text: "2.2 We may request proportionate evidence, but will not create unnecessary barriers. We will keep you informed if the matter is complex and explain the next step.",
        },
        {
          type: "paragraph",
          text: "2.3 A different staff member or manager should review an escalated complaint where practicable. The final response will state the decision, remedy and any external route.",
        },
      ],
    },
    {
      id: "data-protection-complaints",
      heading: "3. Data-protection complaints",
      blocks: [
        {
          type: "paragraph",
          text: "A privacy complaint may be sent to info@thelax.art. We will acknowledge it within 30 days, investigate without undue delay, keep the complainant informed and communicate the outcome. The ICO route in the Privacy Notice remains available.",
        },
      ],
    },
    {
      id: "alternative-dispute-resolution",
      heading: "4. Alternative dispute resolution",
      blocks: [
        {
          type: "paragraph",
          text: "If a Consumer complaint remains unresolved after our final response, we will identify any suitable accredited ADR provider competent to consider the dispute and state whether we agree or are required to use it. We are not currently a member of, and do not make a general commitment to use, a particular ADR scheme. We may agree to ADR for an individual dispute. This policy does not restrict court or statutory rights.",
        },
      ],
    },
  ],
} as const;
