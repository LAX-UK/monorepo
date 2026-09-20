import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { MarketingDetailShell } from "@auction/marketing-ui";

export default function AccountOrderNotFound() {
  return (
    <MarketingDetailShell shellClassName="shop-page shop-page--orders">
      <ShopStatusState
        variant="empty"
        title="Order not found"
        titleAs="h1"
        description="This order does not exist or is not linked to your signed-in account."
        className="shop-status-state--page"
        actions={
          <ShopStatusStateLink href="/account/orders" priority="primary">
            Back to orders
          </ShopStatusStateLink>
        }
      />
    </MarketingDetailShell>
  );
}
