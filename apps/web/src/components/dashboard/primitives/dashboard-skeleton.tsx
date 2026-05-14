import { PageSkeleton, type PageSkeletonVariant } from "@auction/ui/components/page-skeleton";

type DashboardSkeletonVariant = "dashboard" | "list" | "grid";

const toPageVariant = (v: DashboardSkeletonVariant): PageSkeletonVariant => {
  if (v === "list") return "table";
  if (v === "grid") return "grid";
  return "dashboard";
};

const outerClass: Record<DashboardSkeletonVariant, string> = {
  dashboard: "",
  list: "min-h-[12rem]",
  grid: "min-h-[16rem]",
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
