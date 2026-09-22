import { ShopAccountShell } from "@/components/account/shop-account-shell";
import { ShopPageSkeleton } from "@/components/shop-page-skeleton";

export default function AccountLoading() {
  return (
    <ShopAccountShell title="Your account">
      <ShopPageSkeleton variant="commerce" />
    </ShopAccountShell>
  );
}
