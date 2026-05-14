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
};

export interface IAdminListController<
  TRow,
  TQuery extends AdminListQueryBase = AdminListQueryBase,
> {
  readonly id: string;
  parseQuery(searchParams: Record<string, string | string[] | undefined>): TQuery;
  fetch(query: TQuery): Promise<AdminListResult<TRow>>;
}
