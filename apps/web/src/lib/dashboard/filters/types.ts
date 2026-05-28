/**
 * Dashboard list filter config types.
 *
 * To add filters to a new list page:
 * 1. Create `lib/dashboard/filters/{page}/{page}-filters.ts` with parse/serialize helpers.
 * 2. Export a `ListPageFilterConfig` constant describing filter dimensions.
 * 3. Compose a thin `{page}-list-toolbar.tsx` that maps config → shared UI primitives.
 * 4. Keep boards table-only — no filter UI inside board components.
 *
 * Badge vs pill semantics:
 * - `DashboardFilterTrigger` badge counts sheet-collapsed dimensions only (status, year,
 *   category, sort when moved into mobile sheet). Search (`q`) and inline desktop controls
 *   are excluded from the badge.
 * - `DashboardActiveFilters` pills show every non-default dimension including search and sort.
 */

export type ChipOption = {
  id: string;
  label: string;
};

export type SelectOption = {
  value: string;
  label: string;
};

export type FilterDefinition =
  | { kind: "search"; param: "q"; label: string; placeholder: string }
  | {
      kind: "chips";
      param: string;
      label: string;
      options: readonly ChipOption[];
      placement: "primary" | "sheet";
    }
  | { kind: "select"; param: string; label: string; options: readonly SelectOption[] }
  | {
      kind: "multi-select";
      param: string;
      label: string;
      options: readonly ChipOption[];
      placement: "sheet";
    };

export type ListPageFilterConfig = {
  basePath: string;
  defaults: Record<string, string | undefined>;
  filters: readonly FilterDefinition[];
};

export type ActiveFilterDescriptor = {
  id: string;
  label: string;
  href: string;
};

export type FilterParamsRecord = Record<string, string | string[] | undefined>;
