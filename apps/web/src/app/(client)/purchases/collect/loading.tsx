import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { COLLECT_COPY } from "@/lib/collect/collect-copy";
import { Skeleton, pageTitleClass } from "@auction/ui/lax";

/** The booking page while its times are read: the title at once, then the panels. */
export default function CollectLoading() {
  return (
    <DashboardPage>
      <output aria-label="Loading collection times" className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className={pageTitleClass}>{COLLECT_COPY.title}</h1>
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Skeleton className="h-72 rounded-lax-card" />
          <Skeleton className="h-56 rounded-lax-card" />
        </div>
      </output>
    </DashboardPage>
  );
}
