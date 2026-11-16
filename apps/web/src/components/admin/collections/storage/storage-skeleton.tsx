import { SectionSkeleton, Skeleton } from "@auction/staff-ui";

/**
 * The In force card's facts and the lines each takes at 1440: free storage (2), standard, large
 * (2), handling fee, applies to.
 */
const FACTS = [2, 1, 2, 1, 1] as const;
/** The Charging card's explanation and its reason line. */
const CHARGING = [2, 1] as const;

/**
 * The Storage tab while it loads, drawn with the kit's card skeleton so each card matches its
 * real header: the notice, then In force (with its date and "Schedule a change") beside Charging
 * (title only), stacked on a phone, then the History table.
 */
export function StorageSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <Skeleton className="h-24 w-full rounded-staff-lg" />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SectionSkeleton rows={FACTS} description action />
        <SectionSkeleton rows={CHARGING} body="choice" />
      </div>
      <SectionSkeleton rows={3} body="table" />
    </div>
  );
}

/** The "Charging off / on" chip in the page header while the tab loads. */
export function StorageStatusSkeleton() {
  return <Skeleton className="h-5 w-24 rounded-full" />;
}
