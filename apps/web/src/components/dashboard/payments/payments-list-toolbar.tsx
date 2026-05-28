"use client";

import { PAYMENTS_STATUS_FILTER_OPTIONS } from "@/app/dashboard/payments/payments-status-filter";
import {
  DashboardActiveFilters,
  DashboardFilterChipRow,
  DashboardFilterSection,
  DashboardFilterSheet,
  DashboardFilterTrigger,
  DashboardListToolbar,
  DashboardSearchField,
  DashboardSortSelect,
  YearFilterSection,
  useFilterSheetDraft,
} from "@/components/dashboard/filters";
import {
  PAYMENTS_BASE_PATH,
  PAYMENTS_INLINE_YEAR_THRESHOLD,
  PAYMENTS_SORT_OPTIONS,
  type PaymentsFilters,
  buildPaymentsHref,
  countPaymentsMobileSheetFilters,
  countPaymentsSheetFilters,
  getPaymentsActiveFilters,
} from "@/lib/dashboard/filters/payments/payments-filters";
import type { PaymentsSort } from "@/lib/data/view-models/dashboard-payments.vm";
import { FilterChip } from "@auction/ui";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

type PaymentsDraft = {
  year: number | null;
  sort: PaymentsSort;
};

const PAYMENTS_DRAFT_DEFAULTS: PaymentsDraft = {
  year: null,
  sort: "date-desc",
};

type Props = {
  filters: PaymentsFilters;
  years: readonly number[];
};

export function PaymentsListToolbar({ filters, years }: Props) {
  const router = useRouter();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [desktopSheetOpen, setDesktopSheetOpen] = useState(false);
  const fromFilters = useCallback(
    (): PaymentsDraft => ({ year: filters.year, sort: filters.sort }),
    [filters.sort, filters.year],
  );
  const { draft, setDraft, resetDraft } = useFilterSheetDraft({
    mobileOpen: mobileSheetOpen,
    desktopOpen: desktopSheetOpen,
    fromFilters,
    defaultDraft: PAYMENTS_DRAFT_DEFAULTS,
  });

  const activeFilters = useMemo(() => getPaymentsActiveFilters(filters), [filters]);
  const mobileSheetCount = countPaymentsMobileSheetFilters(filters);
  const desktopSheetCount = countPaymentsSheetFilters(filters);
  const useYearSheet = years.length > PAYMENTS_INLINE_YEAR_THRESHOLD;

  const statusItems = PAYMENTS_STATUS_FILTER_OPTIONS.map((opt) => ({
    id: opt.value,
    label: opt.label,
    href: buildPaymentsHref(filters, { status: opt.value }),
    active: opt.value === filters.status,
  }));

  const navigateSort = useCallback(
    (value: string) => {
      router.replace(buildPaymentsHref(filters, { sort: value as PaymentsSort }), {
        scroll: false,
      });
    },
    [filters, router],
  );

  const applyMobileDraft = useCallback(() => {
    router.replace(buildPaymentsHref(filters, { sort: draft.sort, year: draft.year }), {
      scroll: false,
    });
    setMobileSheetOpen(false);
  }, [draft.sort, draft.year, filters, router]);

  const applyDesktopYearDraft = useCallback(() => {
    router.replace(buildPaymentsHref(filters, { year: draft.year }), { scroll: false });
    setDesktopSheetOpen(false);
  }, [draft.year, filters, router]);

  const statusFilterRow = <DashboardFilterChipRow label="Status" items={statusItems} />;

  const yearChipSection = (year: number | null, onYear: (y: number | null) => void) => (
    <YearFilterSection years={years} selectedYear={year} onSelectYear={onYear} />
  );

  const mobileFilterSheet = (
    <DashboardFilterSheet
      open={mobileSheetOpen}
      onOpenChange={setMobileSheetOpen}
      title="Payment filters"
      onApply={applyMobileDraft}
      onReset={resetDraft}
      trigger={<DashboardFilterTrigger activeCount={mobileSheetCount} />}
    >
      <div className="space-y-6">
        {statusFilterRow}
        <DashboardFilterSection label="Sort by">
          <div className="flex flex-wrap gap-2">
            {PAYMENTS_SORT_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.value}
                pressed={draft.sort === opt.value}
                onClick={() => setDraft((current) => ({ ...current, sort: opt.value }))}
              >
                {opt.label}
              </FilterChip>
            ))}
          </div>
        </DashboardFilterSection>
        {years.length > 0
          ? yearChipSection(draft.year, (year) => setDraft((c) => ({ ...c, year })))
          : null}
      </div>
    </DashboardFilterSheet>
  );

  const desktopYearSheet =
    years.length > 0 && useYearSheet ? (
      <DashboardFilterSheet
        open={desktopSheetOpen}
        onOpenChange={setDesktopSheetOpen}
        title="Payment filters"
        onApply={applyDesktopYearDraft}
        onReset={resetDraft}
        trigger={<DashboardFilterTrigger activeCount={desktopSheetCount} />}
      >
        {yearChipSection(draft.year, (year) => setDraft((c) => ({ ...c, year })))}
      </DashboardFilterSheet>
    ) : null;

  const inlineYears =
    years.length > 0 && !useYearSheet ? (
      <DashboardFilterChipRow
        label="Year"
        items={[
          {
            id: "all-years",
            label: "All years",
            href: buildPaymentsHref(filters, { year: null }),
            active: filters.year == null,
          },
          ...years.map((y) => ({
            id: String(y),
            label: String(y),
            href: buildPaymentsHref(filters, { year: y }),
            active: filters.year === y,
          })),
        ]}
      />
    ) : null;

  return (
    <div className="space-y-3">
      <DashboardListToolbar
        searchLabel="Filter payments"
        search={
          <DashboardSearchField
            initialQ={filters.q}
            label="Search payments"
            placeholder="Filter by lot title…"
            inputId="payments-q"
          />
        }
        primaryFilters={
          <div className="space-y-3">
            {statusFilterRow}
            {inlineYears}
          </div>
        }
        sort={
          <DashboardSortSelect
            label="Sort"
            value={filters.sort}
            options={PAYMENTS_SORT_OPTIONS}
            onValueChange={navigateSort}
          />
        }
        hideSortOnMobile
        mobileFilterSheet={mobileFilterSheet}
        filterSheet={desktopYearSheet}
      />
      <DashboardActiveFilters filters={activeFilters} clearAllHref={PAYMENTS_BASE_PATH} />
    </div>
  );
}
