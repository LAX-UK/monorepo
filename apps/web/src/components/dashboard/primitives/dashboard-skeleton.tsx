import { PageSkeleton, type PageSkeletonVariant } from "@auction/ui/components/page-skeleton";

type DashboardSkeletonVariant = "dashboard" | "list" | "grid" | "checkout";

const toPageVariant = (v: DashboardSkeletonVariant): PageSkeletonVariant => {
  if (v === "list") return "table";
  if (v === "grid") return "grid";
  if (v === "checkout") return "checkout";
  return "dashboard";
};

const outerClass: Record<DashboardSkeletonVariant, string> = {
  dashboard: "min-h-[20rem]",
  list: "min-h-[12rem]",
  grid: "min-h-[16rem]",
  checkout: "min-h-[24rem]",
};

export function DashboardSkeleton({
  variant = "dashboard",
}: { variant?: DashboardSkeletonVariant }) {
  return (
    <div className={outerClass[variant]}>
      <PageSkeleton variant={toPageVariant(variant)} />
    </div>
  );
}
