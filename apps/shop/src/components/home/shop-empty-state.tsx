import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import {
  ShopStatusState,
  ShopStatusStateLink,
  type ShopStatusStateVariant,
} from "@/components/shop-status-state";

export type ShopCatalogueStateVariant = ShopStatusStateVariant;

export type ShopCatalogueStateProps = {
  variant: ShopCatalogueStateVariant;
  title: string;
  description: string;
  browseHref?: string;
  browseLabel?: string;
  showRetry?: boolean;
};

export function ShopCatalogueState({
  variant,
  title,
  description,
  browseHref,
  browseLabel,
  showRetry = variant === "error",
}: ShopCatalogueStateProps) {
  return (
    <ShopStatusState
      variant={variant}
      title={title}
      description={description}
      actions={
        showRetry || browseHref ? (
          <>
            {showRetry ? <ShopCatalogueStateRetryButton /> : null}
            {browseHref && browseLabel ? (
              <ShopStatusStateLink href={browseHref}>{browseLabel}</ShopStatusStateLink>
            ) : null}
          </>
        ) : null
      }
    />
  );
}
