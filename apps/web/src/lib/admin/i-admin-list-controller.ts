import type { AdminDisputeCaseSummary } from "@auction/types";

/**
 * List-page abstraction: URL query parsing + paged fetch behind one seam (DIP).
 */
export type AdminListQueryBase = {
  limit: number;
  offset: number;
  q?: string | undefined;
  sort?: string | undefined;
};

export type AdminListResult<TRow> = {
  rows: TRow[];
  /** When unknown, omit for PaginationFooter “of N” */
  total?: number | undefined;
  offset: number;
  limit: number;
  /** Full dataset before a narrow filter (e.g. payments KPI strip while status chip filters the table). */
  rowsForSummary?: TRow[] | undefined;
  /** When total is unknown, set from limit+1 fetch. */
  hasNextPage?: boolean | undefined;
  /** Populated by finance dispute list (full-queue KPI strip). */
  summary?: AdminDisputeCaseSummary | undefined;
  /** Populated by admin payments list (SQL aggregates for the active filter). */
  paymentsSummary?:
    | {
        totalVolume: number;
        captured: number;
        pending: number;
        refunded: number;
      }
    | undefined;
};

export interface IAdminListController<
  TRow,
  TQuery extends AdminListQueryBase = AdminListQueryBase,
> {
  readonly id: string;
  parseQuery(searchParams: Record<string, string | string[] | undefined>): TQuery;
  fetch(query: TQuery): Promise<AdminListResult<TRow>>;
  /**
   * The export of what the list shows, from the same parsed query the rows came from: every
   * view, search and filter, without the page. A list on `ListPage` that offers Export passes
   * this to its export control, so the file always matches the list.
   */
  exportFilters?(query: TQuery): Record<string, unknown>;
}

const PAGING_KEYS: ReadonlySet<string> = new Set(["limit", "offset", "cursor"]);

/**
 * A list query as export filters: the paging dropped, and empty values left out so the export
 * summary only names the filters in force. Arrays are sent as they are.
 */
export function listExportFilters(query: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(query).filter(([key, value]) => {
      if (PAGING_KEYS.has(key)) return false;
      if (value === undefined || value === null || value === "") return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }),
  );
}
