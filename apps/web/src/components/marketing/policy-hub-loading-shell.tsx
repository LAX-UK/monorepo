import { Skeleton } from "@auction/ui";

const ROW_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"] as const;

/** Skeleton that mirrors `PolicyHubLayout` chrome (top tabs + desktop rail + prose). */
export function PolicyHubLoadingShell() {
  return (
    <main
      id="main-content"
      className="bg-page-bg pt-[var(--header-height)] dark:bg-background"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="border-b border-outline-variant/40 px-4 pt-6 sm:px-6 md:px-12">
        <div className="no-scrollbar flex max-w-[var(--container-max,1440px)] snap-x gap-2 overflow-x-auto py-1">
          {ROW_KEYS.map((k) => (
            <Skeleton key={k} className="h-10 w-28 shrink-0 snap-start rounded-sm shimmer-sweep" />
          ))}
        </div>
      </div>
      <div className="grid min-h-[60vh] grid-cols-1 md:grid-cols-[220px_1fr]">
        <aside className="hidden border-r border-outline-variant/40 px-6 py-10 md:block">
          <div className="sticky top-[calc(var(--header-height)+2rem)] flex flex-col gap-2">
            {ROW_KEYS.map((k) => (
              <Skeleton key={`rail-${k}`} className="h-9 w-full rounded-md shimmer-sweep" />
            ))}
          </div>
        </aside>
        <div className="min-w-0 px-6 py-10 md:px-12">
          <Skeleton className="h-10 w-2/3 max-w-lg rounded-sm shimmer-sweep" />
          <Skeleton className="mt-4 h-4 w-40 rounded-sm shimmer-sweep" />
          <div className="mt-8 space-y-3">
            {ROW_KEYS.map((k) => (
              <Skeleton key={`body-${k}`} className="h-4 max-w-full rounded-sm shimmer-sweep" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
