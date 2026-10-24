import { ShopAccountShell } from "@/components/account/shop-account-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { SHOP_ORDERS_HREF } from "@/lib/account/shop-account-routes";

const { title, breadcrumbs } = shopPageWayfinding.orderDetail("Order not found");

export default function AccountOrderNotFound() {
  return (
    <ShopAccountShell title={title} breadcrumbs={breadcrumbs} showAccountSettings={false}>
      <ShopStatusState
        layout="page"
        variant="empty"
        icon="search"
        title="We could not find this order"
        titleAs="h2"
        description="It may belong to another LAX account. Check that you are signed in with the email you used at checkout."
        actions={
          <ShopStatusStateLink href={SHOP_ORDERS_HREF} priority="primary">
            Back to your orders
          </ShopStatusStateLink>
        }
      />
    </ShopAccountShell>
  );
}
