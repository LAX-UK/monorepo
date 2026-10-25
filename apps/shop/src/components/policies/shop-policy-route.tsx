import { ShopPolicyPage } from "@/components/policies/shop-policy-page";
import { SHOP_HELP_LINK, SHOP_POLICY_LINKS, SHOP_PRIVACY_LINKS } from "@/content/footer-nav.config";
import {
  SHOP_POLICY_DOCUMENTS,
  SHOP_POLICY_PATHS,
  SHOP_POLICY_RELEASES,
  type ShopPolicySlug,
} from "@/content/policies";
import {
  loadLinkableShopPolicies,
  loadShopPolicyVisibility,
} from "@/lib/policies/shop-policy-publication.server";
import { NOINDEX_ROBOTS } from "@/lib/seo/shop-indexing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export function shopPolicyMetadata(slug: ShopPolicySlug): Metadata {
  const document = SHOP_POLICY_DOCUMENTS[slug];
  const visibility = loadShopPolicyVisibility(slug);
  return {
    title: `${document.title} | LAX Shop`,
    description: document.summary,
    alternates: { canonical: SHOP_POLICY_PATHS[slug] },
    ...(visibility === "published" ? {} : { robots: NOINDEX_ROBOTS }),
  };
}

/** Renders a policy page, or 404s when it is still a draft on production. */
export function ShopPolicyRoute({ slug }: { slug: ShopPolicySlug }) {
  const visibility = loadShopPolicyVisibility(slug);
  if (visibility === "hidden") notFound();
  // Like the footer, the policy list leaves out drafts that 404 on production.
  const linkable = loadLinkableShopPolicies();
  const hubLinks = [...SHOP_POLICY_LINKS, SHOP_HELP_LINK, ...SHOP_PRIVACY_LINKS]
    .filter((link) => link.slug === slug || linkable.includes(link.slug))
    .map((link) => ({ href: link.href, label: link.label, current: link.slug === slug }));
  return (
    <ShopPolicyPage
      document={SHOP_POLICY_DOCUMENTS[slug]}
      release={SHOP_POLICY_RELEASES[slug]}
      draft={visibility === "draft-preview"}
      hubLinks={hubLinks}
    />
  );
}
