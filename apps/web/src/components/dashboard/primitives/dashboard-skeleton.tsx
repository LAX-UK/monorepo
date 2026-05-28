import { PageSkeleton, type PageSkeletonVariant } from "@auction/ui/components/page-skeleton";

type DashboardSkeletonVariant =
  | "dashboard"
  | "list"
  | "listWithToolbar"
  | "grid"
  | "checkout"
  | "portfolio";

const toPageVariant = (v: DashboardSkeletonVariant): PageSkeletonVariant => {
  if (v === "list" || v === "listWithToolbar") return "table";
  if (v === "grid") return "grid";
  if (v === "checkout") return "checkout";
  return "dashboard";
};

const outerClass: Record<DashboardSkeletonVariant, string> = {
  dashboard: "min-h-[20rem]",
  list: "min-h-[12rem]",
  listWithToolbar: "min-h-[16rem]",
  grid: "min-h-[16rem]",
  checkout: "min-h-[24rem]",
  portfolio: "min-h-[20rem]",
};

function PortfolioSkeleton() {
  return (
    <div className="space-y-8" aria-hidden>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(["a", "b", "c"] as const).map((id) => (
          <div
            key={id}
            className="h-28 animate-pulse rounded-xl border border-border-hairline bg-surface-container-lowest"
          />
        ))}
      </div>
      <div
        data-testid="dashboard-skeleton-toolbar"
        className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest/90 p-4 shadow-sm"
      >
        <div className="flex gap-2">
          <div className="h-11 min-w-0 flex-1 animate-pulse rounded-md bg-surface-container-high/70" />
          <div className="h-11 w-24 animate-pulse rounded-md bg-surface-container-high/70" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(["one", "two", "three"] as const).map((id) => (
          <div
            key={id}
            className="h-48 animate-pulse rounded-xl border border-border-hairline bg-surface-container-lowest"
          />
        ))}
      </div>
    </div>
  );
}

function ListWithToolbarSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div
        data-testid="dashboard-skeleton-toolbar"
        className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest/90 p-4 shadow-sm"
      >
        <div className="flex gap-2">
          <div className="h-11 min-w-0 flex-1 animate-pulse rounded-md bg-surface-container-high/70" />
          <div className="h-11 w-24 animate-pulse rounded-md bg-surface-container-high/70" />
          <div className="h-11 w-24 animate-pulse rounded-md bg-surface-container-high/70" />
        </div>
      </div>
      <div className="space-y-3">
        {(["one", "two", "three", "four", "five"] as const).map((rowId) => (
          <div
            key={rowId}
            data-testid="dashboard-skeleton-row"
            className="h-20 animate-pulse rounded-xl border border-border-hairline bg-surface-container-lowest"
          />
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton({
  variant = "dashboard",
}: { variant?: DashboardSkeletonVariant }) {
  if (variant === "listWithToolbar") {
    return (
      <div className={outerClass.listWithToolbar}>
        <ListWithToolbarSkeleton />
      </div>
    );
  }

  if (variant === "portfolio") {
    return (
      <div className={outerClass.portfolio}>
        <PortfolioSkeleton />
      </div>
    );
  }

  return (
    <div className={outerClass[variant]}>
      <PageSkeleton variant={toPageVariant(variant)} />
    </div>
  );
}
