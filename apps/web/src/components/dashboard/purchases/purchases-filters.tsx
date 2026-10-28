"use client";

import {
  DashboardActiveFilters,
  DashboardFilterSheet,
  DashboardFilterTrigger,
} from "@/components/dashboard/filters";
import {
  PORTFOLIO_PAYMENT_OPTIONS,
  type PortfolioFilters,
  buildPortfolioHref,
  getPortfolioActiveFilters,
} from "@/lib/dashboard/filters/portfolio/portfolio-filters";
import { FilterChip } from "@auction/ui";
import { Input } from "@auction/ui/components/input";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useId, useMemo, useState } from "react";

const CHIP = "normal-case tracking-normal font-medium text-sm";

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3 border-0 p-0">
      <legend className="mb-3 font-body text-sm font-semibold text-on-surface">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** How many of the purchase filters are in use, for the button's count. */
export function countPurchaseFilters(filters: PortfolioFilters): number {
  return [filters.q.trim() !== "", filters.payment !== "all", filters.year != null].filter(Boolean)
    .length;
}

/** Keeps the view (`?tab=`) when the filters change. */
function withTab(href: string, tab: string | null): string {
  if (!tab) return href;
  return `${href}${href.includes("?") ? "&" : "?"}tab=${encodeURIComponent(tab)}`;
}

/**
 * Purchases' filters behind one "Filters" button with a count: title, payment and year, in the
 * shared filter sheet. Choices apply together and keep the view.
 */
export function PurchasesFilters({
  filters,
  years,
}: {
  filters: PortfolioFilters;
  years: readonly number[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams?.get("tab") ?? null;
  const searchId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PortfolioFilters>(filters);
  const onOpenChange = (next: boolean) => {
    if (next) setDraft(filters);
    setOpen(next);
  };
  const apply = () => {
    router.replace(withTab(buildPortfolioHref(filters, draft), tab), { scroll: false });
    setOpen(false);
  };

  return (
    <DashboardFilterSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Filter purchases"
      onApply={apply}
      onReset={() => setDraft({ q: "", payment: "all", year: null })}
      trigger={
        <DashboardFilterTrigger
          activeCount={countPurchaseFilters(filters)}
          className="w-fit text-sm"
        />
      }
    >
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-2">
          <label htmlFor={searchId} className="font-body text-sm font-semibold text-on-surface">
            Title
          </label>
          <Input
            id={searchId}
            type="search"
            value={draft.q}
            placeholder="Search your purchases"
            onChange={(event) => setDraft({ ...draft, q: event.target.value })}
          />
        </div>
        <Group legend="Payment">
          <div className="flex flex-wrap gap-2">
            {PORTFOLIO_PAYMENT_OPTIONS.map((option) => (
              <FilterChip
                key={option.id}
                className={CHIP}
                pressed={draft.payment === option.id}
                onClick={() => setDraft({ ...draft, payment: option.id })}
              >
                {option.label}
              </FilterChip>
            ))}
          </div>
        </Group>
        {years.length > 0 ? (
          <Group legend="Won in">
            <div className="flex flex-wrap gap-2">
              <FilterChip
                className={CHIP}
                pressed={draft.year == null}
                onClick={() => setDraft({ ...draft, year: null })}
              >
                Any year
              </FilterChip>
              {years.map((year) => (
                <FilterChip
                  key={year}
                  className={CHIP}
                  pressed={draft.year === year}
                  onClick={() => setDraft({ ...draft, year })}
                >
                  {year}
                </FilterChip>
              ))}
            </div>
          </Group>
        ) : null}
      </div>
    </DashboardFilterSheet>
  );
}

/** The purchase filters in use, as removable chips that keep the view; nothing when none are. */
export function PurchasesActiveFilters({ filters }: { filters: PortfolioFilters }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams?.get("tab") ?? null;
  const active = useMemo(
    () =>
      getPortfolioActiveFilters(filters).map((chip) => ({
        ...chip,
        href: withTab(chip.href, tab),
      })),
    [filters, tab],
  );
  if (active.length === 0) return null;
  return (
    <DashboardActiveFilters
      filters={active}
      clearAllHref={withTab(pathname, tab)}
      className="mb-0 md:mb-0"
    />
  );
}
