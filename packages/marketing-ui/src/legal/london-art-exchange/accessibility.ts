import type { LegalPolicyDocument } from "../policy/policy-document.js";

/**
 * Accessibility and Reasonable Adjustments Statement, as published by London Art Exchange Ltd at https://www.thelax.art/accessibility
 * (version 1.0, effective 2026-08-12). Business-team text: keep the wording and clause numbers.
 */
export const ACCESSIBILITY_POLICY: LegalPolicyDocument<"accessibility"> = {
  slug: "accessibility",
  title: "Accessibility and Reasonable Adjustments Statement",
  summary: "Our accessibility commitments and how to request a reasonable adjustment.",
  sections: [
    {
      id: "our-approach",
      heading: "1. Our approach",
      blocks: [
        {
          type: "paragraph",
          text: "London Art Exchange Ltd aims to make its Website, purchasing process, communications and gallery services usable by disabled people. We use WCAG 2.2 level AA as our practical digital benchmark and make reasonable adjustments appropriate to individual needs.",
        },
        {
          type: "paragraph",
          text: "The Website is being improved against WCAG 2.2 level AA and may not yet meet every success criterion. Known risk areas include older PDFs, some embedded third-party services, keyboard focus, form labels, contrast and alternative text on historic content. We prioritise contact, account, consent and purchase journeys and provide an alternative route when a digital barrier is reported.",
        },
      ],
    },
    {
      id: "measures",
      heading: "2. Measures",
      blocks: [
        {
          type: "paragraph",
          text: "Our implementation standard includes:",
        },
        {
          type: "list",
          items: [
            "keyboard-operable navigation, forms, checkout and cookie controls;",
            "visible focus, logical headings, labels and useful error messages;",
            "text alternatives for functional images and meaningful artwork descriptions;",
            "sufficient contrast and content that reflows under zoom;",
            "captions or transcripts for relevant media;",
            "accessible HTML alternatives to inaccessible PDFs;",
            "no essential instruction conveyed by colour alone; and",
            "telephone or email assistance and an alternative ordering route where reasonably required.",
          ],
        },
      ],
    },
    {
      id: "requesting-an-adjustment-or-reporting-a-problem",
      heading: "3. Requesting an adjustment or reporting a problem",
      blocks: [
        {
          type: "paragraph",
          text: "Contact info@thelax.art or +44 20 8044 1334 and describe the page, format or gallery adjustment needed. We will not charge a disabled customer for a reasonable adjustment. Alternative formats may include structured HTML, large print, a read-aloud appointment or another practical format.",
        },
      ],
    },
    {
      id: "review",
      heading: "4. Review",
      blocks: [
        {
          type: "paragraph",
          text: "We test templates before release, conduct periodic automated and manual checks, include disabled-user testing where proportionate, and record remediation. This statement is reviewed after a material redesign and at least annually.",
        },
      ],
    },
  ],
} as const;
