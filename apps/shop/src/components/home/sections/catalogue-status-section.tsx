import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";

type CatalogueStatusSectionProps = {
  message: string;
};

export function CatalogueStatusSection({ message }: CatalogueStatusSectionProps) {
  return (
    <>
      <p className="sr-only">{message}</p>
      <ShopStatusState
        variant="error"
        title="Catalogue temporarily unavailable"
        description="Live artwork links and availability are hidden for now. You can still explore editorial content below, try again, or browse the catalogue directly."
        className="shop-status-state--banner"
        actions={
          <>
            <ShopCatalogueStateRetryButton />
            <ShopStatusStateLink href="/artworks">Browse artworks</ShopStatusStateLink>
          </>
        }
      />
    </>
  );
}
