"use client";

import {
  type CalendarSalesUrlState,
  calendarSalesHrefFromState,
} from "@/lib/marketing/sales-calendar-params";
import type { CalendarTab } from "@/lib/marketing/sales-calendar-tabs";
import { type LinkProps, TabNav } from "@auction/ui/lax";
import Link from "next/link";

/** A calendar tab changes what the list shows, so it keeps the reader's place on the page. */
function CalendarTabLink({ prefetch: _prefetch, ...props }: LinkProps) {
  return <Link {...props} scroll={false} prefetch={false} />;
}

type Props = {
  state: CalendarSalesUrlState;
  tabs: readonly CalendarTab[];
};

/** The calendar's sections as kit tabs; the ones that do not fit go into "More". */
export function SalesPrimaryTabs({ state, tabs }: Props) {
  return (
    <TabNav
      label="Calendar sections"
      Link={CalendarTabLink}
      activeId={state.tab}
      items={tabs.map((t) => ({
        id: t.id,
        label: t.label,
        href: calendarSalesHrefFromState(state, { tab: t.id, page: undefined }),
        ...(t.count !== undefined ? { count: t.count, countLabel: "sales" } : {}),
      }))}
    />
  );
}
