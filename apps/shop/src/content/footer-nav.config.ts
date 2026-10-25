import {
  SHOP_POLICY_PATHS,
  SHOP_POLICY_SOURCES,
  type ShopPolicySlug,
} from "@/content/policies/shop-policy-status";
import {
  LAX_ART_LEGAL_INDEX,
  LAX_ART_POLICIES,
  LAX_ART_POLICY_ORDER,
  type LaxArtPolicySlug,
} from "@auction/marketing-ui";

type ShopPolicyLink = { slug: ShopPolicySlug; label: string; href: string };

export const SHOP_HELP_LINK: ShopPolicyLink = {
  slug: "help",
  label: "Help and contact",
  href: SHOP_POLICY_PATHS.help,
};

const SHOP_SLUG_BY_SOURCE = new Map(
  (Object.entries(SHOP_POLICY_SOURCES) as [ShopPolicySlug, LaxArtPolicySlug][]).map(
    ([shopSlug, source]) => [source, shopSlug],
  ),
);

/**
 * The London Art Exchange Ltd policies Shop publishes on its own routes, in the order of the
 * company's legal index, with the names the business team gave them.
 */
export const SHOP_POLICY_LINKS: readonly ShopPolicyLink[] = LAX_ART_POLICY_ORDER.flatMap(
  (source) => {
    const slug = SHOP_SLUG_BY_SOURCE.get(source);
    return slug
      ? [{ slug, label: LAX_ART_POLICIES[source].label, href: SHOP_POLICY_PATHS[slug] }]
      : [];
  },
);

export type ShopLegalMenuLink = { label: string; href: string; current: boolean };

/**
 * Every London Art Exchange Ltd policy for the menu beside a policy page: Shop's own pages, and
 * the rest (and the legal index) on lax.art when its address is known.
 */
export function buildShopLegalMenu(input: {
  current: ShopPolicySlug | null;
  linkable: readonly ShopPolicySlug[];
  artBaseUrl: URL | null;
}): ShopLegalMenuLink[] {
  const links: ShopLegalMenuLink[] = [];
  if (input.current === "help" || input.linkable.includes("help")) {
    links.push({
      label: SHOP_HELP_LINK.label,
      href: SHOP_HELP_LINK.href,
      current: input.current === "help",
    });
  }
  if (input.artBaseUrl) {
    links.push({
      label: LAX_ART_LEGAL_INDEX.title,
      href: new URL("/legal", input.artBaseUrl).toString(),
      current: false,
    });
  }
  for (const source of LAX_ART_POLICY_ORDER) {
    const slug = SHOP_SLUG_BY_SOURCE.get(source);
    const label = LAX_ART_POLICIES[source].label;
    if (slug) {
      if (slug === input.current || input.linkable.includes(slug)) {
        links.push({ label, href: SHOP_POLICY_PATHS[slug], current: slug === input.current });
      }
    } else if (input.artBaseUrl) {
      links.push({
        label,
        href: new URL(LAX_ART_POLICIES[source].artPath, input.artBaseUrl).toString(),
        current: false,
      });
    }
  }
  return links;
}
