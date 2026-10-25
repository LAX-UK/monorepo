import { ShopPolicyPage } from "@/components/policies/shop-policy-page";
import { buildShopLegalMenu } from "@/content/footer-nav.config";
import {
  SHOP_POLICY_DOCUMENTS,
  SHOP_POLICY_PATHS,
  SHOP_POLICY_RELEASES,
  type ShopPolicySlug,
  buildShopHelpDocument,
} from "@/content/policies";
import { SHOP_ORDERS_HREF } from "@/lib/account/shop-account-routes";
import { loadShopArtBaseUrl } from "@/lib/ecosystem/product-directory.server";
import { laxAccountUrl } from "@/lib/lax-account-url";
import {
  loadLinkableShopPolicies,
  loadShopPolicyVisibility,
} from "@/lib/policies/shop-policy-publication.server";
import { NOINDEX_ROBOTS } from "@/lib/seo/shop-indexing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

function documentFor(slug: ShopPolicySlug) {
  if (slug === "help") {
    return buildShopHelpDocument({
      ordersHref: SHOP_ORDERS_HREF,
      accountHref: laxAccountUrl(),
      artBaseUrl: loadShopArtBaseUrl(),
    });
  }
  return SHOP_POLICY_DOCUMENTS[slug];
}

export function shopPolicyMetadata(slug: ShopPolicySlug): Metadata {
  const document = documentFor(slug);
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
  const hubLinks = buildShopLegalMenu({
    current: slug,
    linkable: loadLinkableShopPolicies(),
    artBaseUrl: loadShopArtBaseUrl(),
  });
  return (
    <ShopPolicyPage
      document={documentFor(slug)}
      release={SHOP_POLICY_RELEASES[slug]}
      draft={visibility === "draft-preview"}
      hubLinks={hubLinks}
      {...(slug === "help" ? {} : { company: "shop" as const })}
    />
  );
}
