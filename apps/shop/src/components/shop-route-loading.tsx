import { ShopPageSkeleton, type ShopPageSkeletonVariant } from "@/components/shop-page-skeleton";
import { MarketingDetailShell } from "@auction/marketing-ui";

type ShopRouteLoadingProps = {
  variant: ShopPageSkeletonVariant;
  shellClassName?: string;
};

export function ShopRouteLoading({ variant, shellClassName = "shop-page" }: ShopRouteLoadingProps) {
  return (
    <MarketingDetailShell shellClassName={shellClassName}>
      <ShopPageSkeleton variant={variant} />
    </MarketingDetailShell>
  );
}
