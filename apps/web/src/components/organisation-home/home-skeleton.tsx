import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { cn } from "@auction/ui";
import { Skeleton } from "@auction/ui/lax";
import { HomePair } from "./home-pair";
import { HomePanel } from "./home-section";

const TASKS = ["a", "b", "c"] as const;
const FIGURES = ["a", "b", "c", "d"] as const;
const ROWS = ["a", "b", "c"] as const;
const STAGES = ["a", "b", "c", "d", "e", "f"] as const;
const SHORTCUT_ROWS = ["a", "b"] as const;

function SectionHeading() {
  return (
    <div className="mb-3 flex min-h-6 items-center">
      <Skeleton className="h-4 w-32" />
    </div>
  );
}

/** A sale card's placeholder: the mat, then the title, when and the works. */
function SaleCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-lax-card border border-lax-line", className)}>
      <Skeleton className="h-36 rounded-none sm:h-44 lg:h-48" />
      <div className="flex flex-col gap-2 px-5 pt-4 pb-5">
        <Skeleton className="h-4 w-44 max-w-full" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-1 h-5 w-20" />
      </div>
    </div>
  );
}

/**
 * Home while it loads, in Home's own shape: "Needs you" rows, the figures as cells of one card,
 * then the two pairs of sections. The title shows at once; heights are reserved so nothing jumps when the
 * data lands.
 */
export function HomeSkeleton() {
  return (
    <DashboardPage className="space-y-0 md:space-y-0">
      <DashboardPageHeader title="Home" className="mb-6 lg:mb-8" />
      <output aria-label="Loading Home" className="flex flex-col gap-8 lg:gap-10">
        <div>
          <SectionHeading />
          <HomePanel>
            {TASKS.map((key) => (
              <div
                key={key}
                className="flex min-h-16 items-center gap-4 border-t border-lax-line-subtle px-4 py-3 first:border-t-0 sm:pl-5"
              >
                <Skeleton className="size-10 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton className="h-3.5 w-56 max-w-full" />
                  <Skeleton className="h-3 w-80 max-w-full" />
                </div>
                <Skeleton className="hidden h-9 w-24 sm:block" />
              </div>
            ))}
          </HomePanel>
        </div>
        <div>
          <SectionHeading />
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lax-card border border-lax-line bg-lax-line-subtle lg:grid-cols-4">
            {FIGURES.map((key) => (
              <div
                key={key}
                className="flex min-h-28 flex-col gap-3 bg-lax-surface px-6 py-5 lg:min-h-32"
              >
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-28" />
                <Skeleton className="mt-auto h-3 w-20" />
              </div>
            ))}
          </div>
        </div>
        <HomePair
          wide={
            <>
              <SectionHeading />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SaleCardSkeleton />
                <SaleCardSkeleton className="hidden sm:block" />
              </div>
            </>
          }
          narrow={
            <>
              <SectionHeading />
              <HomePanel className="py-2">
                {ROWS.map((key) => (
                  <div key={key} className="flex flex-col gap-2 px-5 py-2.5">
                    <Skeleton className="h-3.5 w-56 max-w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </HomePanel>
            </>
          }
        />
        <HomePair
          wide={
            <>
              <SectionHeading />
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lax-card border border-lax-line bg-lax-line-subtle sm:grid-cols-6">
                {STAGES.map((key) => (
                  <div
                    key={key}
                    className="flex min-h-20 flex-col gap-2 bg-lax-surface px-3 py-3 sm:px-4 sm:py-4"
                  >
                    <Skeleton className="h-5 w-6" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                ))}
              </div>
            </>
          }
          narrow={
            <>
              <SectionHeading />
              <HomePanel className="p-1">
                {SHORTCUT_ROWS.map((key) => (
                  <div key={key} className="flex h-11 items-center px-4">
                    <Skeleton className="h-3.5 w-32" />
                  </div>
                ))}
              </HomePanel>
            </>
          }
        />
      </output>
    </DashboardPage>
  );
}
