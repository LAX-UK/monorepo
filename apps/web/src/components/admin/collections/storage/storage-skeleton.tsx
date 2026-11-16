import { SectionSkeleton, Skeleton } from "@auction/staff-ui";

/** The In force card's facts: free storage, standard, large, handling fee, applies to. */
const FACTS = 5;

/**
 * The Storage tab while it loads, drawn with the kit's card skeleton so each card matches its
 * real header: the notice, then In force (with its date and "Schedule a change") beside Charging
 * (title only), stacked on a phone, then the History table.
 */
export function StorageSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <Skeleton className="h-16 w-full rounded-staff-lg" />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SectionSkeleton rows={FACTS} description action />
        <SectionSkeleton rows={2} />
      </div>
      <SectionSkeleton rows={4} body="table" />
    </div>
  );
}

/** The "Charging off / on" chip in the page header while the tab loads. */
export function StorageStatusSkeleton() {
  return <Skeleton className="h-5 w-24 rounded-full" />;
}
