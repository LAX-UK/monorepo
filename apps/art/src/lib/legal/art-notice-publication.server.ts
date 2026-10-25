import { loadArtEnv, loadArtStorefrontBaseUrl } from "@/env.server";
import {
  artNoticeVisibility,
  isArtProductionDeployment,
  linkableArtNotices,
} from "@/lib/legal/art-notice-publication";
import type { ArtExchangeNoticeSlug, LegalPolicyVisibility } from "@auction/marketing-ui";

function isProduction(): boolean {
  return isArtProductionDeployment({
    storefrontHost: loadArtStorefrontBaseUrl().hostname,
    deployEnv: loadArtEnv().ART_DEPLOY_ENV,
  });
}

export function loadArtNoticeVisibility(slug: ArtExchangeNoticeSlug): LegalPolicyVisibility {
  return artNoticeVisibility(slug, isProduction());
}

export function loadLinkableArtNotices(): ArtExchangeNoticeSlug[] {
  return linkableArtNotices(isProduction());
}
