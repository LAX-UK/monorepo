"use client";

import {
  DashboardBannerStack,
  type DashboardBannerStackProps,
} from "@/components/dashboard/dashboard-banner-stack";
import { isDashboardListRoute } from "@/lib/dashboard/list-routes";
import { usePathname } from "next/navigation";

export function DashboardBannerStackClient(props: DashboardBannerStackProps) {
  const pathname = usePathname();
  const compact = isDashboardListRoute(pathname);
  return <DashboardBannerStack {...props} maxVisible={compact ? 1 : 2} compactOverflow={compact} />;
}
