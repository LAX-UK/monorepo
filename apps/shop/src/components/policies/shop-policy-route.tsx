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
import { loadCheckoutDeliveryTimes } from "@/lib/checkout/checkout-delivery.server";
import { buildDeliveryGlance } from "@/lib/delivery/delivery-glance";
import { readDeliveryRegions } from "@/lib/delivery/delivery-regions.server";
import { loadShopArtBaseUrl } from "@/lib/ecosystem/product-directory.server";
import { laxAccountUrl } from "@/lib/lax-account-url";
import {
  loadLinkableShopPolicies,
  loadShopPolicyVisibility,
} from "@/lib/policies/shop-policy-publication.server";
import { NOINDEX_ROBOTS } from "@/lib/seo/shop-indexing";
import { isShopFramingEnabled } from "@/lib/shop-runtime-flags";
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

/**
 * The delivery policy opens with "Delivery at a glance": the UK from what checkout charges and
 * shows, the other regions from the live delivery regions. If those cannot be read the section
 * still shows, without their times, instead of the page failing.
 */
async function documentWithGlance(slug: ShopPolicySlug) {
  const document = documentFor(slug);
  if (slug !== "delivery") return document;
  const glance = buildDeliveryGlance({
    regions: await readDeliveryRegions(),
    ukDelivery: loadCheckoutDeliveryTimes().ukDelivery,
    framingEnabled: isShopFramingEnabled(),
  });
  return { ...document, sections: [glance, ...document.sections] };
}

/** Renders a policy page, or 404s when it is still a draft on production. */
export async function ShopPolicyRoute({ slug }: { slug: ShopPolicySlug }) {
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
      document={await documentWithGlance(slug)}
      release={SHOP_POLICY_RELEASES[slug]}
      draft={visibility === "draft-preview"}
      hubLinks={hubLinks}
      {...(slug === "help" ? {} : { company: "shop" as const })}
    />
  );
}
