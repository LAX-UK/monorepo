import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { MarketingDetailShell } from "@auction/marketing-ui";

export const metadata = shopPrivatePageTitle("Page not found");

export default function ShopNotFoundPage() {
  return (
    <MarketingDetailShell shellClassName="shop-page shop-page--not-found">
      <ShopStatusState
        variant="empty"
        icon="ticket"
        title="Page not found"
        titleAs="h1"
        description="This shop page does not exist or may have moved."
        className="shop-status-state--page"
        actions={
          <>
            <ShopStatusStateLink href="/" priority="primary">
              Shop home
            </ShopStatusStateLink>
            <ShopStatusStateLink href="/artworks">Browse artworks</ShopStatusStateLink>
          </>
        }
      />
    </MarketingDetailShell>
  );
}
