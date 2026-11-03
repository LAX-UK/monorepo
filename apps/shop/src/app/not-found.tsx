import { SHOP_HELP_LINK } from "@/content/footer-nav.config";
import { loadLinkableShopPolicies } from "@/lib/policies/shop-policy-publication.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { MarketingDetailShell, MarketingNotFound } from "@auction/marketing-ui";
import Link from "next/link";

export const metadata = shopPrivatePageTitle("Page not found");

export default function ShopNotFoundPage() {
  const helpLinked = loadLinkableShopPolicies().includes(SHOP_HELP_LINK.slug);
  return (
    <MarketingDetailShell wrapChildren={false}>
      <MarketingNotFound
        Link={Link}
        illustration="ticket"
        title="We can’t find that page"
        description="It may have moved, or the edition is no longer listed. Search for it, or start from editions or artists."
        search={{
          action: "/artworks",
          label: "Search editions and artists",
          placeholder: "Artist or title",
        }}
        links={[
          { href: "/artworks", label: "Browse editions" },
          { href: "/artists", label: "See the artists" },
          ...(helpLinked ? [{ href: SHOP_HELP_LINK.href, label: SHOP_HELP_LINK.label }] : []),
        ]}
      />
    </MarketingDetailShell>
  );
}
