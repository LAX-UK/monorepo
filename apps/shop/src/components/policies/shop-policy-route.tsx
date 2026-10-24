import { ShopPolicyPage } from "@/components/policies/shop-policy-page";
import {
  SHOP_POLICY_DOCUMENTS,
  SHOP_POLICY_PATHS,
  SHOP_POLICY_RELEASES,
  type ShopPolicySlug,
} from "@/content/policies";
import { loadShopPolicyVisibility } from "@/lib/policies/shop-policy-publication.server";
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
  return (
    <ShopPolicyPage
      document={SHOP_POLICY_DOCUMENTS[slug]}
      release={SHOP_POLICY_RELEASES[slug]}
      draft={visibility === "draft-preview"}
    />
  );
}
