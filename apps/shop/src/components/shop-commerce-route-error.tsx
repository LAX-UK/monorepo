"use client";

import {
  ShopStatusState,
  ShopStatusStateAction,
  ShopStatusStateLink,
} from "@/components/shop-status-state";
import { MarketingDetailShell } from "@auction/marketing-ui";

type ShopCommerceRouteErrorProps = {
  title?: string;
  description?: string;
  reset: () => void;
  backHref?: string;
  backLabel?: string;
};

export function ShopCommerceRouteError({
  title = "Something went wrong",
  description = "We could not complete this request. Try again or return to a safe page.",
  reset,
  backHref = "/",
  backLabel = "Return home",
}: ShopCommerceRouteErrorProps) {
  return (
    <MarketingDetailShell shellClassName="shop-page shop-page--error">
      <ShopStatusState
        variant="error"
        title={title}
        titleAs="h1"
        description={description}
        className="shop-status-state--page"
        actions={
          <>
            <ShopStatusStateAction priority="primary" onClick={reset}>
              Try again
            </ShopStatusStateAction>
            <ShopStatusStateLink href={backHref}>{backLabel}</ShopStatusStateLink>
          </>
        }
      />
    </MarketingDetailShell>
  );
}
