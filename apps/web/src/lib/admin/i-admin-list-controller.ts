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
}
