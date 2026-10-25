import type { LegalPolicyDocument, LegalPolicyRelease } from "../policy/policy-document.js";
import { ACCESSIBILITY_POLICY } from "./accessibility.js";
import { AML_IDENTITY_CHECKS_POLICY } from "./aml-identity-checks.js";
import { COMPLAINTS_POLICY } from "./complaints.js";
import { COOKIES_POLICY } from "./cookies.js";
import { ETHICAL_SOURCING_POLICY } from "./ethical-sourcing.js";
import { PRIVACY_POLICY } from "./privacy.js";
import { RETURNS_POLICY } from "./returns.js";
import { REVIEWS_POLICY } from "./reviews.js";
import { SHIPPING_POLICY } from "./shipping.js";
import { TERMS_POLICY } from "./terms.js";

/**
 * The published policies of London Art Exchange Ltd, which runs lax.art and LAX Shop. Both
 * products read this one source; the text is the business team's, taken from www.thelax.art.
 * One internal note to staff was left out of the cookie notice (see `cookies.ts`).
 */
export type LaxArtPolicySlug =
  | "terms"
  | "returns"
  | "shipping"
  | "privacy"
  | "cookies"
  | "complaints"
  | "accessibility"
  | "aml-identity-checks"
  | "reviews"
  | "ethical-sourcing";

export type LaxArtPolicy = {
  slug: LaxArtPolicySlug;
  /** Name in policy menus, footers and the legal index. */
  label: string;
  /** One line for the legal index and the meta description. */
  description: string;
  document: LegalPolicyDocument<LaxArtPolicySlug>;
  release: LegalPolicyRelease;
  /** Route on lax.art. */
  artPath: string;
  /** The page's address on the previous www.thelax.art site, redirected to `artPath`. */
  legacyPath: string;
};

const RELEASE_1_0: LegalPolicyRelease = {
  status: "approved",
  version: "1.0",
  lastUpdated: "2026-08-12",
  dateLabel: "Effective date",
};

function policy(
  document: LegalPolicyDocument<LaxArtPolicySlug>,
  label: string,
  legacyPath: string,
): LaxArtPolicy {
  return {
    slug: document.slug,
    label,
    description: document.summary,
    document,
    release: RELEASE_1_0,
    artPath: `/legal/${document.slug}`,
    legacyPath,
  };
}

export const LAX_ART_POLICIES: Readonly<Record<LaxArtPolicySlug, LaxArtPolicy>> = {
  terms: policy(TERMS_POLICY, "Terms of Sale", "/terms-of-sale"),
  returns: policy(RETURNS_POLICY, "Returns & Cancellation", "/returns-cancellation"),
  shipping: policy(SHIPPING_POLICY, "Shipping & Delivery", "/shipping-delivery"),
  privacy: policy(PRIVACY_POLICY, "Privacy Notice", "/privacy-notice"),
  cookies: policy(COOKIES_POLICY, "Cookie Preferences", "/cookie-notice"),
  complaints: policy(COMPLAINTS_POLICY, "Complaints & ADR", "/complaints-adr"),
  accessibility: policy(ACCESSIBILITY_POLICY, "Accessibility", "/accessibility"),
  "aml-identity-checks": policy(
    AML_IDENTITY_CHECKS_POLICY,
    "AML & Identity",
    "/aml-identity-checks",
  ),
  reviews: policy(REVIEWS_POLICY, "Reviews Policy", "/reviews-policy"),
  "ethical-sourcing": policy(ETHICAL_SOURCING_POLICY, "Ethical Sourcing", "/ethical-sourcing"),
};

/** The legal index: its introduction and its groups, in the order the business team set. */
export const LAX_ART_LEGAL_INDEX = {
  title: "Legal & Policies",
  intro:
    "The terms, notices and statements that apply when you buy from London Art Exchange. Each is published in full and maintained separately. Previous versions are archived and available on request.",
  groups: [
    { title: "Buying from us", slugs: ["terms", "returns", "shipping"] },
    { title: "Your data", slugs: ["privacy", "cookies"] },
    {
      title: "Our standards",
      slugs: ["complaints", "accessibility", "aml-identity-checks", "reviews", "ethical-sourcing"],
    },
  ],
} as const satisfies {
  title: string;
  intro: string;
  groups: readonly { title: string; slugs: readonly LaxArtPolicySlug[] }[];
};

/** Every policy in index order. */
export const LAX_ART_POLICY_ORDER: readonly LaxArtPolicySlug[] = LAX_ART_LEGAL_INDEX.groups.flatMap(
  (group) => group.slugs,
);

export function isLaxArtPolicySlug(slug: string): slug is LaxArtPolicySlug {
  return Object.hasOwn(LAX_ART_POLICIES, slug);
}
