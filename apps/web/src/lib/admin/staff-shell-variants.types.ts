/**
 * Staff list/hub shell variant contracts — extend through typed slots, not route conditionals.
 * See docs/ui/staff-ui-architecture.md
 */
export type StaffListShellVariant = "catalog" | "queue" | "people" | "finance" | "hub";

export type StaffShellSlot =
  | "kpiBand"
  | "filterBar"
  | "board"
  | "drawer"
  | "pagination"
  | "empty"
  | "error";

/** Narrow page-model contract for staff list routes. */
export type StaffListPageModel<TFilter = unknown> = {
  readonly basePath: string;
  readonly hasFilters: boolean;
  readonly filters: TFilter;
};

/** KPI tile input for list bands — kept separate from row VMs. */
export type StaffKpiTileContract = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
};

/** List board container — always compose tables inside CatalogBoardCard. */
export type StaffBoardCardContract = {
  readonly usesCatalogBoardCard: true;
};
