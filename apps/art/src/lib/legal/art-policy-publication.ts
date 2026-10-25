import { ART_PRODUCTION_HOSTS } from "@/lib/seo/art-indexing";
import {
  LAX_ART_POLICIES,
  LAX_ART_POLICY_ORDER,
  type LaxArtPolicySlug,
  type LegalPolicyRelease,
  type LegalPolicyVisibility,
  isProductionDeployEnv,
  resolveLegalPolicyVisibility,
} from "@auction/marketing-ui";

type Releases = Readonly<Record<LaxArtPolicySlug, LegalPolicyRelease>>;

const RELEASES = Object.fromEntries(
  LAX_ART_POLICY_ORDER.map((slug) => [slug, LAX_ART_POLICIES[slug].release]),
) as Releases;

/** Production is the launch host or an image built for prod; either one is enough. */
export function isArtProductionDeployment(input: {
  storefrontHost: string;
  deployEnv: string | undefined;
}): boolean {
  const host = input.storefrontHost.split(":")[0]?.trim().toLowerCase() ?? "";
  return ART_PRODUCTION_HOSTS.has(host) || isProductionDeployEnv(input.deployEnv);
}

/** Published policies show everywhere; a future draft shows with a banner off production only. */
export function artPolicyVisibility(
  slug: LaxArtPolicySlug,
  production: boolean,
  releases: Releases = RELEASES,
): LegalPolicyVisibility {
  return resolveLegalPolicyVisibility(releases[slug], production);
}

/** Policies that may be linked (footer, legal list, cookie banner) on this deployment. */
export function linkableArtPolicies(
  production: boolean,
  releases: Releases = RELEASES,
): LaxArtPolicySlug[] {
  return LAX_ART_POLICY_ORDER.filter(
    (slug) => artPolicyVisibility(slug, production, releases) !== "hidden",
  );
}
