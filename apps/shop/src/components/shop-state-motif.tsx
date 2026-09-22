import { MarketingStatusMotif, type MarketingStatusStateMotif } from "@auction/marketing-ui";

export type ShopStateMotifVariant = "empty" | "search" | "bag" | "alert";

type ShopStateMotifProps = {
  variant: ShopStateMotifVariant;
};

function mapMotif(variant: ShopStateMotifVariant): MarketingStatusStateMotif {
  if (variant === "empty") {
    return "gallery";
  }
  return variant;
}

export function ShopStateMotif({ variant }: ShopStateMotifProps) {
  return <MarketingStatusMotif motif={mapMotif(variant)} />;
}
