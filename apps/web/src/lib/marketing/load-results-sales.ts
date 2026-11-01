import "server-only";

import { getServerSalesList } from "@/lib/data/http/sales.server";
import { type LoadResult, settle } from "@/lib/marketing/load-result";
import { type ResultsRowVM, buildResultsRows, resultsYears } from "@/lib/marketing/results-page.vm";

export const RESULTS_PAGE_SIZE = 12;

/** More than any page needs, so years and the lots filter see every sale that has results. */
const ENDED_SALES_WINDOW = 100;

export type ResultsSalesPage = {
  rows: ResultsRowVM[];
  hasMore: boolean;
};

/** Ended sales with results, newest first, one page at a time. A failed read is not "no sales". */
export async function loadResultsSalesPage(page: number): Promise<LoadResult<ResultsSalesPage>> {
  return settle("results sales", async () => {
    const offset = (page - 1) * RESULTS_PAGE_SIZE;
    const sales = await getServerSalesList({
      status: "ended",
      sort: "endDesc",
      limit: RESULTS_PAGE_SIZE + 1,
      offset,
    });
    const hasMore = sales.length > RESULTS_PAGE_SIZE;
    return { rows: buildResultsRows(sales.slice(0, RESULTS_PAGE_SIZE)), hasMore };
  });
}

/** Years in which a sale with results closed. A failed read gives none, which hides the filter. */
export async function loadResultsYears(): Promise<number[]> {
  const result = await settle("results years", async () =>
    resultsYears(
      await getServerSalesList({ status: "ended", sort: "endDesc", limit: ENDED_SALES_WINDOW }),
    ),
  );
  return result.ok ? result.value : [];
}
