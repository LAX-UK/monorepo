import {
  ART_EXCHANGE_NOTICE_RELEASES,
  type LegalPolicyRelease,
  type LegalPolicyStatus,
} from "@auction/marketing-ui";

export { isProductionDeployEnv } from "@auction/marketing-ui";

/**
 * Release state of each Shop policy page, kept apart from the page text so links (footer,
 * checkout) can check it without loading the content.
 *
 * A page moves to "approved" only after legal review, with every `[TO CONFIRM: …]` placeholder
 * filled (a unit test enforces this). Bump `version` and `lastUpdated` with every wording change.
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

export type ShopPolicyStatus = LegalPolicyStatus;
export type ShopPolicyRelease = LegalPolicyRelease;

export const SHOP_POLICY_RELEASES: Readonly<Record<ShopPolicySlug, ShopPolicyRelease>> = {
  terms: { status: "draft", version: "0.1", lastUpdated: "2026-10-25" },
  delivery: { status: "draft", version: "0.1", lastUpdated: "2026-10-25" },
  returns: { status: "draft", version: "0.1", lastUpdated: "2026-10-25" },
  help: { status: "draft", version: "0.1", lastUpdated: "2026-10-25" },
  // London Art Exchange Ltd's notices cover LAX Shop and lax.art; lax.art publishes the same text.
  privacy: ART_EXCHANGE_NOTICE_RELEASES.privacy,
  cookies: ART_EXCHANGE_NOTICE_RELEASES.cookies,
};
