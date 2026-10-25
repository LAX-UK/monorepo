import { loadArtEnv, loadArtStorefrontBaseUrl } from "@/env.server";
import {
  artPolicyVisibility,
  isArtProductionDeployment,
  linkableArtPolicies,
} from "@/lib/legal/art-policy-publication";
import type { LaxArtPolicySlug, LegalPolicyVisibility } from "@auction/marketing-ui";

function isProduction(): boolean {
  return isArtProductionDeployment({
    storefrontHost: loadArtStorefrontBaseUrl().hostname,
    deployEnv: loadArtEnv().ART_DEPLOY_ENV,
  });
}

export function loadArtPolicyVisibility(slug: LaxArtPolicySlug): LegalPolicyVisibility {
  return artPolicyVisibility(slug, isProduction());
}

export function loadLinkableArtPolicies(): LaxArtPolicySlug[] {
  return linkableArtPolicies(isProduction());
}
