/**
 * Release state of each Shop policy page, kept apart from the page text so `next.config.ts` can
 * read it without loading the content. This file has no imports for the same reason.
 *
 * A page moves to "approved" only after legal review, with every `[TO CONFIRM: …]` placeholder
 * filled (a unit test enforces this). Bump `version` and `lastUpdated` with every wording change.
 */
export type ShopPolicySlug = "terms" | "delivery" | "returns" | "help";

export const SHOP_POLICY_PATHS: Readonly<Record<ShopPolicySlug, string>> = {
  terms: "/terms",
  delivery: "/delivery",
  returns: "/returns",
  help: "/help",
};

export type ShopPolicyStatus = "draft" | "approved";

export type ShopPolicyRelease = {
  status: ShopPolicyStatus;
  version: string;
  /** ISO date (YYYY-MM-DD) of the last wording change. */
  lastUpdated: string;
};

export const SHOP_POLICY_RELEASES: Readonly<Record<ShopPolicySlug, ShopPolicyRelease>> = {
  terms: { status: "draft", version: "0.1", lastUpdated: "2026-10-25" },
  delivery: { status: "draft", version: "0.1", lastUpdated: "2026-10-25" },
  returns: { status: "draft", version: "0.1", lastUpdated: "2026-10-25" },
  help: { status: "draft", version: "0.1", lastUpdated: "2026-10-25" },
};

export function draftShopPolicySlugs(
  releases: Readonly<Record<ShopPolicySlug, ShopPolicyRelease>> = SHOP_POLICY_RELEASES,
): ShopPolicySlug[] {
  return (Object.keys(releases) as ShopPolicySlug[]).filter(
    (slug) => releases[slug].status === "draft",
  );
}

/** `SHOP_DEPLOY_ENV` is set from the image build's environment ("test" or "prod"). */
export function isProductionDeployEnv(deployEnv: string | undefined): boolean {
  const value = deployEnv?.trim().toLowerCase();
  return value === "prod" || value === "production";
}

/**
 * Build guard: a production image cannot be built while a policy page is still a draft.
 * Called from `next.config.ts`, so `next build` stops before any page is compiled.
 */
export function assertShopPoliciesPublishable(
  deployEnv: string | undefined,
  releases: Readonly<Record<ShopPolicySlug, ShopPolicyRelease>> = SHOP_POLICY_RELEASES,
): void {
  if (!isProductionDeployEnv(deployEnv)) return;
  const drafts = draftShopPolicySlugs(releases);
  if (drafts.length > 0) {
    throw new Error(
      `LAX Shop policy pages are still drafts for legal review (${drafts.join(", ")}). Approve them in src/content/policies/shop-policy-status.ts before building for production.`,
    );
  }
}
