import { ShopRouteLoading } from "@/components/shop-route-loading";

export default function CheckoutConfirmationLoading() {
  return (
    <ShopRouteLoading
      variant="commerce"
      shellClassName="shop-page shop-page--checkout-confirmation"
    />
  );
}
