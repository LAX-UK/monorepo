import { ART_PRODUCTION_HOSTS } from "@/lib/seo/art-indexing";
import {
  ART_EXCHANGE_NOTICE_RELEASES,
  type ArtExchangeNoticeSlug,
  type LegalPolicyRelease,
  type LegalPolicyVisibility,
  isProductionDeployEnv,
  resolveLegalPolicyVisibility,
} from "@auction/marketing-ui";

/**
 * lax.art publishes London Art Exchange Ltd's privacy notice and cookie policy from code, with
 * the same draft rules as Shop's policies: a banner off production, 404 and no links on it.
 */
export const ART_NOTICE_SLUGS: readonly ArtExchangeNoticeSlug[] = ["privacy", "cookies"];

export function isArtNoticeSlug(slug: string): slug is ArtExchangeNoticeSlug {
  return (ART_NOTICE_SLUGS as readonly string[]).includes(slug);
}

/** Production is the launch host or an image built for prod; either one is enough. */
export function isArtProductionDeployment(input: {
  storefrontHost: string;
  deployEnv: string | undefined;
}): boolean {
  const host = input.storefrontHost.split(":")[0]?.trim().toLowerCase() ?? "";
  return ART_PRODUCTION_HOSTS.has(host) || isProductionDeployEnv(input.deployEnv);
}

export function artNoticeVisibility(
  slug: ArtExchangeNoticeSlug,
  production: boolean,
  releases: Readonly<
    Record<ArtExchangeNoticeSlug, LegalPolicyRelease>
  > = ART_EXCHANGE_NOTICE_RELEASES,
): LegalPolicyVisibility {
  return resolveLegalPolicyVisibility(releases[slug], production);
}

/** Notices that may be linked (footer, legal list, cookie banner) on this deployment. */
export function linkableArtNotices(
  production: boolean,
  releases: Readonly<
    Record<ArtExchangeNoticeSlug, LegalPolicyRelease>
  > = ART_EXCHANGE_NOTICE_RELEASES,
): ArtExchangeNoticeSlug[] {
  return ART_NOTICE_SLUGS.filter(
    (slug) => artNoticeVisibility(slug, production, releases) !== "hidden",
  );
}
