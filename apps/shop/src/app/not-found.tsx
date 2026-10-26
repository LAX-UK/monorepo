import { ShopSearchForm } from "@/components/shop-search-form";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { SHOP_HELP_LINK } from "@/content/footer-nav.config";
import { loadLinkableShopPolicies } from "@/lib/policies/shop-policy-publication.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { MarketingDetailShell } from "@auction/marketing-ui";

export const metadata = shopPrivatePageTitle("Page not found");

export default function ShopNotFoundPage() {
  const helpLinked = loadLinkableShopPolicies().includes(SHOP_HELP_LINK.slug);
  return (
    <MarketingDetailShell shellClassName="shop-page shop-page--not-found">
      <ShopStatusState
        variant="empty"
        icon="ticket"
        title="We can’t find that page"
        titleAs="h1"
        description="It may have moved, or the edition is no longer listed. Search for it, or start from editions or artists."
        className="shop-status-state--page"
        control={<ShopSearchForm id="not-found-search" />}
        actions={
          <>
            <ShopStatusStateLink href="/artworks" priority="primary">
              Browse editions
            </ShopStatusStateLink>
            <ShopStatusStateLink href="/artists">See the artists</ShopStatusStateLink>
            {helpLinked ? (
              <ShopStatusStateLink href={SHOP_HELP_LINK.href}>
                {SHOP_HELP_LINK.label}
              </ShopStatusStateLink>
            ) : null}
          </>
        }
      />
    </MarketingDetailShell>
  );
}
