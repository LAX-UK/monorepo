import "server-only";

import { getServerSalesList } from "@/lib/data/http/sales.server";
import { settle } from "@/lib/marketing/load-result";
import type { CalendarOverview } from "@/lib/marketing/sales-calendar-overview";
import type { CalendarPrimaryTab } from "@/lib/marketing/sales-calendar-params";
import type { Sale } from "@auction/types";

/** The API's page limit: sections hold far fewer sales than this. */
const OVERVIEW_LIMIT = 100;

const SECTION_STATUS: Record<CalendarPrimaryTab, Sale["status"]> = {
  live: "active",
  upcoming: "scheduled",
  results: "ended",
};

/**
 * Reads what each calendar section holds, in the department being viewed, so the tabs can carry
 * counts and the empty state can point at the last results. Sections load independently: one
 * that fails is left out and its tab simply shows no count.
 */
export async function loadCalendarOverview(categoryId?: string): Promise<CalendarOverview> {
  const sections = Object.keys(SECTION_STATUS) as CalendarPrimaryTab[];
  const loaded = await Promise.all(
    sections.map(async (tab) => {
      const status = SECTION_STATUS[tab];
      const result = await settle(`sales calendar ${tab} overview`, () =>
        getServerSalesList({
          status,
          limit: OVERVIEW_LIMIT,
          offset: 0,
          sort: status === "ended" ? "endDesc" : "startAsc",
          ...(categoryId ? { categoryId } : {}),
        }),
      );
      return [tab, result] as const;
    }),
  );
  const overview: CalendarOverview = {};
  for (const [tab, result] of loaded) {
    if (result.ok) overview[tab] = result.value;
  }
  return overview;
}
