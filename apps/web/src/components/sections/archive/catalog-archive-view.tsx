import {
  ArchiveLotCardView,
  ArchiveLotGridView,
  ArchiveLotListView,
  type ArchiveLotVM,
} from "@/components/sections/archive/catalog-archive-views";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";

export type CatalogArchiveViewProps = {
  view: CatalogLayoutView;
  items: ArchiveLotVM[];
  currentUserId: string | null;
};

export function CatalogArchiveView({ view, items, currentUserId }: CatalogArchiveViewProps) {
  if (view === "list") return <ArchiveLotListView items={items} currentUserId={currentUserId} />;
  if (view === "card") return <ArchiveLotCardView items={items} currentUserId={currentUserId} />;
  return <ArchiveLotGridView items={items} currentUserId={currentUserId} />;
}
