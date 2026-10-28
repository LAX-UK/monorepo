import type { LegalPolicyDocument } from "../policy/policy-document.js";

/**
 * Consumer Reviews Policy, as published by London Art Exchange Ltd at https://www.thelax.art/reviews-policy
 * (version 1.0, effective 2026-08-12). Business-team text: keep the wording and clause numbers.
 */
export const REVIEWS_POLICY: LegalPolicyDocument<"reviews"> = {
  slug: "reviews",
  title: "Consumer Reviews Policy",
  summary: "How customer reviews are collected, verified and published.",
  sections: [
    {
      id: "principles",
      heading: "1. Principles",
      blocks: [
        {
          type: "paragraph",
          text: "We do not write, buy, commission or knowingly publish fake reviews. We take reasonable and proportionate steps to prevent and remove them. We do not suppress a genuine negative review merely because it is critical.",
        },
      ],
    },
    {
      id: "verification-and-labels",
      heading: "2. Verification and labels",
      blocks: [
        {
          type: "paragraph",
          text: "We explain what verified purchase means and apply it only where the review is matched to a genuine transaction. A review from an event attendee, artist, employee, connected person or non-purchaser is labelled accurately. Any free item, discount, payment, competition entry or other incentive is disclosed prominently.",
        },
      ],
    },
    {
      id: "moderation",
      heading: "3. Moderation",
      blocks: [
        {
          type: "paragraph",
          text: "We may reject or remove content that is unlawful, fake, unrelated, abusive, discriminatory, threatening, infringes rights, reveals personal/confidential information or contains malicious links. We retain a reason and audit log. We do not edit a rating or materially rewrite a review; minor formatting or redaction is identified where relevant.",
        },
      ],
    },
    {
      id: "ratings-and-ordering",
      heading: "4. Ratings and ordering",
      blocks: [
        {
          type: "paragraph",
          text: "Published ratings, summaries and sorting use documented rules. We do not distort an overall score by selectively excluding negative reviews or mixing incomparable sources without explanation.",
        },
      ],
    },
    {
      id: "reporting",
      heading: "5. Reporting",
      blocks: [
        {
          type: "paragraph",
          text: "Suspected fake, incentivised without disclosure, or unlawful reviews can be reported to info@lax.art. We will investigate, record the decision and correct or remove content where appropriate.",
        },
      ],
    },
  ],
} as const;
