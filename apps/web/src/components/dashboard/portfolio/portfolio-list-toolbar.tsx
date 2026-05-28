"use client";

import {
  DashboardActiveFilters,
  DashboardFilterChipRow,
  DashboardFilterSection,
  DashboardFilterSheet,
  DashboardFilterTrigger,
  DashboardListToolbar,
  DashboardSearchField,
} from "@/components/dashboard/filters";
import {
  PORTFOLIO_BASE_PATH,
  PORTFOLIO_INLINE_YEAR_THRESHOLD,
  PORTFOLIO_PAYMENT_OPTIONS,
  type PortfolioFilters,
  buildPortfolioHref,
  countPortfolioMobileSheetFilters,
  countPortfolioSheetFilters,
  getPortfolioActiveFilters,
} from "@/lib/dashboard/filters/portfolio/portfolio-filters";
import { FilterChip } from "@auction/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  filters: PortfolioFilters;
  years: readonly number[];
};

export function PortfolioListToolbar({ filters, years }: Props) {
  const router = useRouter();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [desktopSheetOpen, setDesktopSheetOpen] = useState(false);
  const [draftYear, setDraftYear] = useState<number | null>(filters.year);

  useEffect(() => {
    if (!mobileSheetOpen && !desktopSheetOpen) setDraftYear(filters.year);
  }, [desktopSheetOpen, filters.year, mobileSheetOpen]);

  const activeFilters = useMemo(() => getPortfolioActiveFilters(filters), [filters]);
  const mobileSheetCount = countPortfolioMobileSheetFilters(filters);
  const desktopSheetCount = countPortfolioSheetFilters(filters);
  const useYearSheet = years.length > PORTFOLIO_INLINE_YEAR_THRESHOLD;

  const paymentItems = PORTFOLIO_PAYMENT_OPTIONS.map((opt) => ({
    id: opt.id,
    label: opt.label,
    href: buildPortfolioHref(filters, { payment: opt.id }),
    active: filters.payment === opt.id,
  }));

  const paymentFilterRow = <DashboardFilterChipRow label="Payment" items={paymentItems} />;

  const applyYearDraft = useCallback(() => {
    router.replace(buildPortfolioHref(filters, { year: draftYear }), { scroll: false });
    setMobileSheetOpen(false);
    setDesktopSheetOpen(false);
  }, [draftYear, filters, router]);

  const resetYearDraft = useCallback(() => {
    setDraftYear(null);
  }, []);

  const yearSection = (
    <DashboardFilterSection label="Acquired in">
      <div className="flex flex-wrap gap-2">
        <FilterChip pressed={draftYear == null} onClick={() => setDraftYear(null)}>
          All years
        </FilterChip>
        {years.map((y) => (
          <FilterChip key={y} pressed={draftYear === y} onClick={() => setDraftYear(y)}>
            {y}
          </FilterChip>
        ))}
      </div>
    </DashboardFilterSection>
  );

  const mobileFilterSheet = (
    <DashboardFilterSheet
      open={mobileSheetOpen}
      onOpenChange={setMobileSheetOpen}
      title="Collection filters"
      {...(years.length > 0 ? { onApply: applyYearDraft, onReset: resetYearDraft } : {})}
      trigger={<DashboardFilterTrigger activeCount={mobileSheetCount} />}
    >
      <div className="space-y-6">
        {paymentFilterRow}
        {years.length > 0 ? yearSection : null}
      </div>
    </DashboardFilterSheet>
  );

  const desktopYearSheet =
    years.length > 0 && useYearSheet ? (
      <DashboardFilterSheet
        open={desktopSheetOpen}
        onOpenChange={setDesktopSheetOpen}
        title="Collection filters"
        onApply={applyYearDraft}
        onReset={resetYearDraft}
        trigger={<DashboardFilterTrigger activeCount={desktopSheetCount} />}
      >
        {yearSection}
      </DashboardFilterSheet>
    ) : null;

  const inlineYears =
    years.length > 0 && !useYearSheet ? (
      <DashboardFilterChipRow
        label="Acquired in"
        items={[
          {
            id: "all-years",
            label: "All years",
            href: buildPortfolioHref(filters, { year: null }),
            active: filters.year == null,
          },
          ...years.map((y) => ({
            id: String(y),
            label: String(y),
            href: buildPortfolioHref(filters, { year: y }),
            active: filters.year === y,
          })),
        ]}
      />
    ) : null;

  return (
    <div className="space-y-3">
      <DashboardListToolbar
        searchLabel="Filter collection"
        search={
          <DashboardSearchField
            initialQ={filters.q}
            label="Search collection"
            placeholder="Filter by title…"
            inputId="portfolio-q"
          />
        }
        primaryFilters={
          <div className="space-y-3">
            {paymentFilterRow}
            {inlineYears}
          </div>
        }
        mobileFilterSheet={mobileFilterSheet}
        filterSheet={desktopYearSheet}
      />
      <DashboardActiveFilters filters={activeFilters} clearAllHref={PORTFOLIO_BASE_PATH} />
    </div>
  );
}
