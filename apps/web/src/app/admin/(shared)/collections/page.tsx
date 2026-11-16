import { CollectionsLoadingSkeleton } from "@/components/admin/collections/collections-loading-skeleton";
import { CollectionsPage } from "@/components/admin/collections/collections-page";
import {
  type CollectionsAccess,
  collectionTabsFor,
  parseCollectionTab,
} from "@/lib/admin/collections/collections.vm";
import { loadCollectionsPage } from "@/lib/admin/collections/load-collections-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import {
  COLLECTIONS_ACCESS,
  COLLECTIONS_PAGE_ACCESS,
  COLLECTIONS_READ_ACCESS,
  COLLECTION_STORAGE_ACCESS,
  COLLECTION_STORAGE_READ_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { londonToday } from "@auction/staff-ui";
import type { UserRole } from "@auction/types";
import { userHasAccessTo } from "@auction/types";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = metadataForPrivate(
  "Collections",
  "Who is coming to collect, and when. Hand over after checking photo ID.",
);

type Search = Record<string, string | string[] | undefined>;

type Rights = { access: CollectionsAccess; canChange: boolean; canChangeStorage: boolean };

async function CollectionsContent({
  search,
  today,
  rights,
}: {
  search: Search;
  today: string;
  rights: Rights;
}) {
  const model = await loadCollectionsPage(search, today, rights.access);
  return (
    <CollectionsPage
      {...model}
      tabs={collectionTabsFor(rights.access)}
      canChange={rights.canChange}
      canChangeStorage={rights.canChangeStorage}
      today={today}
    />
  );
}

/**
 * Collections, for everyone with a tab on it: Fulfilment and read-only staff see the visits,
 * hours, storage and closures; Finance sees Storage only. While a tab loads, its own skeleton
 * holds the page's shape.
 */
export default async function AdminCollectionsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await requireAdminCapability(COLLECTIONS_PAGE_ACCESS, "/admin/collections");
  const can = (requirement: typeof COLLECTIONS_ACCESS) =>
    userHasAccessTo(user.role as UserRole, user.staffRoles, requirement);
  const rights: Rights = {
    access: {
      settings: can(COLLECTIONS_READ_ACCESS),
      storage: can(COLLECTION_STORAGE_READ_ACCESS),
    },
    canChange: can(COLLECTIONS_ACCESS),
    canChangeStorage: can(COLLECTION_STORAGE_ACCESS),
  };
  const search = await searchParams;
  const today = londonToday();
  return (
    <Suspense
      key={JSON.stringify(search)}
      fallback={
        <CollectionsLoadingSkeleton
          tab={parseCollectionTab(search.tab, rights.access)}
          tabs={collectionTabsFor(rights.access)}
        />
      }
    >
      <CollectionsContent search={search} today={today} rights={rights} />
    </Suspense>
  );
}
