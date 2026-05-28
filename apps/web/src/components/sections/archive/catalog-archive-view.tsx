import {
  ArchiveLotCardView,
  ArchiveLotGridView,
  ArchiveLotListView,
  type ArchiveLotVM,
} from "@/components/sections/archive/catalog-archive-views";
import type { CatalogLinkParams } from "@/lib/marketing/catalog-links";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";

export type CatalogArchiveViewProps = {
  view: CatalogLayoutView;
  items: ArchiveLotVM[];
  currentUserId: string | null;
  catalogLinkParams?: CatalogLinkParams;
};

export function CatalogArchiveView({
  view,
  items,
  currentUserId,
  catalogLinkParams,
}: CatalogArchiveViewProps) {
  const linkProps = catalogLinkParams ? { catalogLinkParams } : {};
  if (view === "list") {
    return <ArchiveLotListView items={items} currentUserId={currentUserId} {...linkProps} />;
  }
  if (view === "card") {
    return <ArchiveLotCardView items={items} currentUserId={currentUserId} {...linkProps} />;
  }
  return <ArchiveLotGridView items={items} currentUserId={currentUserId} {...linkProps} />;
}
