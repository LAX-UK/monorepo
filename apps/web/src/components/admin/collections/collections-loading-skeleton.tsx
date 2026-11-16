import {
  COLLECTION_TABS,
  COLLECTION_TAB_LABELS,
  type CollectionTab,
  DESK_TABS,
  collectionsHref,
} from "@/lib/admin/collections/collections.vm";
import { STORAGE_COPY } from "@/lib/admin/collections/storage-copy";
import { FormPage, Skeleton, TabNav } from "@auction/staff-ui";
import Link from "next/link";
import { ROW_COLUMNS } from "./desk-row-columns";
import { OverdueSkeleton } from "./overdue/overdue-skeleton";
import { StorageSkeleton, StorageStatusSkeleton } from "./storage/storage-skeleton";

const ROWS = 4;

/**
 * Collections while it loads: the real FormPage header (title, "Book for a client" slot and the
 * section tabs), then the shape of the tab being opened. The desk tabs show the column headings and
 * stacked visit rows at the height of a DeskVisitRow, Storage its cards, so nothing moves when the
 * content arrives. Rows and cards stack on a phone, as the real ones do.
 */
export function CollectionsLoadingSkeleton({
  tab = "day",
  tabs = COLLECTION_TABS,
}: {
  tab?: CollectionTab;
  tabs?: readonly CollectionTab[];
}) {
  return (
    <FormPage
      title="Collections"
      description={
        tab === "storage"
          ? STORAGE_COPY.pageDescription
          : "Who is coming to collect, and when. Hand over after checking photo ID."
      }
      tabs={
        <TabNav
          label="Collections sections"
          Link={Link}
          items={tabs.map((id) => ({
            id,
            label: COLLECTION_TAB_LABELS[id],
            href: collectionsHref(id, null),
          }))}
          activeId={tab}
        />
      }
      {...(DESK_TABS.includes(tab) && tabs.includes("day")
        ? { primaryAction: <Skeleton className="h-control-sm w-36 rounded-staff-sm" /> }
        : {})}
      {...(tab === "storage" ? { status: <StorageStatusSkeleton /> } : {})}
    >
      {tab === "storage" ? (
        <StorageSkeleton />
      ) : tab === "not_collected" && !tabs.includes("day") ? (
        <OverdueSkeleton />
      ) : (
        <div aria-busy="true" className="flex flex-col gap-8">
          {tab === "not_collected" ? <OverdueSkeleton /> : null}
          <div>
            <div
              aria-hidden="true"
              className={`hidden gap-6 px-4 pb-2 text-staff-xs font-medium text-staff-muted lg:grid ${ROW_COLUMNS}`}
            >
              <span>Buyer</span>
              <span>Collector</span>
              <span>Lots</span>
              <span>Work</span>
              <span>Booking</span>
              <span />
            </div>
            <ul className="rounded-staff-md border border-staff-line bg-staff-surface px-4 py-4">
              {Array.from({ length: ROWS }, (_, index) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders
                  key={index}
                  className={`grid gap-3 py-4 first:pt-0 last:pb-0 lg:items-center lg:gap-6 ${ROW_COLUMNS}`}
                >
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex gap-2">
                      <Skeleton className="size-9 rounded-staff-xs" />
                      <Skeleton className="size-9 rounded-staff-xs" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div>
                    <Skeleton className="h-5 w-16 rounded-staff-sm" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-control-sm w-24 rounded-staff-sm" />
                    <Skeleton className="h-control-sm w-24 rounded-staff-sm" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </FormPage>
  );
}
