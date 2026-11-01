"use client";

import { useUrlLayoutView } from "@/lib/hooks/use-url-layout-view";
import { useViewQueryNavigation } from "@/lib/hooks/use-view-query-navigation";
import { salesBrowseViewCookieValue } from "@/lib/preferences/view-query-navigation";
import { type SegmentOption, SegmentedControl } from "@auction/ui/lax";
import { CalendarDays, LayoutGrid, Rows3 } from "lucide-react";

export type SalesBrowseView = "grid" | "list" | "calendar";

const MODES: readonly SegmentOption<SalesBrowseView>[] = [
  { value: "grid", label: "Grid", icon: <LayoutGrid aria-hidden />, iconOnly: true },
  { value: "list", label: "List", icon: <Rows3 aria-hidden />, iconOnly: true },
  { value: "calendar", label: "Calendar", icon: <CalendarDays aria-hidden />, iconOnly: true },
];

/** Sales calendar view toggle (grid / list / agenda-by-month). Uses the same URL + scroll
 * navigation as `CatalogViewSwitcher`; adds `calendar` mode and sales-specific cookie mapping. */
export function SalesViewSwitcher({
  value,
  defaultView = "grid",
}: {
  value: SalesBrowseView;
  defaultView?: SalesBrowseView;
}) {
  const liveView = useUrlLayoutView(defaultView, value) as SalesBrowseView;
  const { navigate, pending } = useViewQueryNavigation({
    routeKey: "sales",
    defaultView,
    toCookieValue: salesBrowseViewCookieValue,
  });

  return (
    <SegmentedControl
      label="View"
      value={liveView}
      onValueChange={navigate}
      options={MODES}
      disabled={pending}
    />
  );
}
