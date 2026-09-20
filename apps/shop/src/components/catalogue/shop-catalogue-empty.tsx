import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";

type ShopCatalogueEmptyProps = {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

export function ShopCatalogueEmpty({
  title,
  description,
  actionHref,
  actionLabel,
}: ShopCatalogueEmptyProps) {
  return (
    <ShopStatusState
      variant="empty"
      title={title}
      description={description}
      actions={
        actionHref && actionLabel ? (
          <ShopStatusStateLink href={actionHref}>{actionLabel}</ShopStatusStateLink>
        ) : null
      }
    />
  );
}
