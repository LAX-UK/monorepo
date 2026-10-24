/**
 * Release state of each Shop policy page, kept apart from the page text so links (footer,
 * checkout) can check it without loading the content.
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

/** `SHOP_DEPLOY_ENV` is set from the image build's environment ("test" or "prod"). */
export function isProductionDeployEnv(deployEnv: string | undefined): boolean {
  const value = deployEnv?.trim().toLowerCase();
  return value === "prod" || value === "production";
}
