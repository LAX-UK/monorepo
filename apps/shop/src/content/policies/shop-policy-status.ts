import {
  LAX_ART_POLICIES,
  type LaxArtPolicySlug,
  type LegalPolicyRelease,
  type LegalPolicyStatus,
} from "@auction/marketing-ui";

export { isProductionDeployEnv } from "@auction/marketing-ui";

/**
 * Shop's policy pages. LAX Shop and lax.art are both run by London Art Exchange Ltd, so each
 * page publishes that company's policy from the shared source in `@auction/marketing-ui`.
 * Release state is kept apart from the page text so links (footer, checkout) can check it
 * without loading the content; a page in "draft" shows a banner off production and 404s on it.
 */
export type ShopPolicySlug = "terms" | "delivery" | "returns" | "help" | "privacy" | "cookies";

export const SHOP_POLICY_PATHS: Readonly<Record<ShopPolicySlug, string>> = {
  terms: "/terms",
  delivery: "/delivery",
  returns: "/returns",
  help: "/help",
  privacy: "/privacy",
  cookies: "/cookies",
};

/** Shop pages that publish a London Art Exchange Ltd policy; /help is Shop's own page. */
export type ShopSourcedPolicySlug = Exclude<ShopPolicySlug, "help">;

/** The London Art Exchange Ltd policy each Shop page publishes. */
export const SHOP_POLICY_SOURCES: Readonly<Record<ShopSourcedPolicySlug, LaxArtPolicySlug>> = {
  terms: "terms",
  delivery: "shipping",
  returns: "returns",
  privacy: "privacy",
  cookies: "cookies",
};

/** Help and contact: contact details and links, not a policy. */
export const SHOP_HELP_RELEASE: LegalPolicyRelease = {
  status: "approved",
  version: "1.0",
  lastUpdated: "2026-10-25",
};

export type ShopPolicyStatus = LegalPolicyStatus;
export type ShopPolicyRelease = LegalPolicyRelease;

export const SHOP_POLICY_RELEASES: Readonly<Record<ShopPolicySlug, ShopPolicyRelease>> = {
  terms: LAX_ART_POLICIES[SHOP_POLICY_SOURCES.terms].release,
  delivery: LAX_ART_POLICIES[SHOP_POLICY_SOURCES.delivery].release,
  returns: LAX_ART_POLICIES[SHOP_POLICY_SOURCES.returns].release,
  help: SHOP_HELP_RELEASE,
  privacy: LAX_ART_POLICIES[SHOP_POLICY_SOURCES.privacy].release,
  cookies: LAX_ART_POLICIES[SHOP_POLICY_SOURCES.cookies].release,
};
