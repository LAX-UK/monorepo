import "server-only";

import { getServerLotReader } from "@/lib/catalog/catalog.server";
import { type LoadResult, settle } from "@/lib/marketing/load-result";
import { RECENTLY_SOLD_LIMIT, recentlySoldWorks } from "@/lib/marketing/sell-landing";
import type { Lot } from "@auction/types";

/** Reads past the row's limit so unsold lots never leave the row short. */
const SOLD_READ = RECENTLY_SOLD_LIMIT * 4;

/** The house's most recently sold works across every department. */
export async function loadRecentlySold(): Promise<LoadResult<Lot[]>> {
  return settle("recently sold works", async () => {
    const reader = await getServerLotReader();
    const rows = await reader.list({ status: "ended", sort: "endedDesc", limit: SOLD_READ });
    return recentlySoldWorks(rows);
  });
}
