"use client";

import { SalesAuctionList } from "@/components/sections/sales/sales-auction-list";
import { SalesCalendarGrid } from "@/components/sections/sales/sales-calendar-grid";
import { SalesCalendarMonthGrid } from "@/components/sections/sales/sales-calendar-month-grid";
import type {
  CalendarGridCardVM,
  SaleAgendaItemVM,
  SaleAuctionRowVM,
} from "@/components/sections/sales/sales-view-models";
import type { SalesBrowseView } from "@/components/sections/sales/sales-view-switcher";
import { useUrlLayoutView } from "@/lib/hooks/use-url-layout-view";

type Props = {
  initialView: SalesBrowseView;
  defaultView?: SalesBrowseView;
  agendaVms: SaleAgendaItemVM[];
  gridVms: CalendarGridCardVM[];
  rowVms: SaleAuctionRowVM[];
};

export function SalesBrowseResults({
  initialView,
  defaultView = "grid",
  agendaVms,
  gridVms,
  rowVms,
}: Props) {
  const view = useUrlLayoutView(defaultView, initialView) as SalesBrowseView;

  if (view === "calendar") {
    return <SalesCalendarMonthGrid items={agendaVms} />;
  }
  if (view === "grid") {
    return <SalesCalendarGrid vms={gridVms} />;
  }
  return <SalesAuctionList rows={rowVms} className="gap-2 sm:gap-2 lg:gap-3" />;
}
