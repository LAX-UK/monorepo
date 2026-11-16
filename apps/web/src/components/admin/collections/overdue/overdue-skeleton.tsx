import { NOT_COLLECTED_COPY } from "@/lib/admin/collections/not-collected-copy";
import { Section, Skeleton } from "@auction/staff-ui";

const ROWS = 3;

/**
 * The Past collect-by section while it loads: its real title and description, then rows at the
 * height of an OverdueRow (days over, lot, collect-by, storage and band, actions), stacked on a
 * phone as the real ones are.
 */
export function OverdueSkeleton() {
  const C = NOT_COLLECTED_COPY.section;
  return (
    <Section title={C.title} description={C.description}>
      <div aria-busy="true" className="flex flex-col gap-4">
        <Skeleton className="h-3 w-36" />
        <ul className="flex flex-col divide-y divide-staff-line rounded-staff-md border border-staff-line bg-staff-surface">
          {Array.from({ length: ROWS }, (_, index) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders
              key={index}
              className="flex flex-col gap-3 px-4 py-4 md:flex-row md:justify-between md:gap-6"
            >
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-56" />
                <Skeleton className="h-3 w-44" />
                <Skeleton className="mt-1 h-3 w-64" />
                <Skeleton className="h-3 w-28" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-control-sm w-36 rounded-staff-sm" />
                <Skeleton className="h-control-sm w-28 rounded-staff-sm" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
