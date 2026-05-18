"use client";

import {
  PAYMENTS_STATUS_FILTER_OPTIONS,
  type PaymentsStatusFilter,
  paymentsFilterHref,
} from "@/app/dashboard/payments/payments-status-filter";
import { FilterRowNav } from "@/components/dashboard/filter-row-nav";
import { PaymentsToolbar } from "@/components/dashboard/payments-toolbar";
import { DashboardToolbar } from "@/components/dashboard/primitives/dashboard-toolbar";

const PAGE_PATH = "/dashboard/payments";

type Props = {
  filter: PaymentsStatusFilter;
  initialQ: string;
  sort: Parameters<typeof PaymentsToolbar>[0]["sort"];
  year: number | null;
  years: number[];
};

export function PaymentsPageToolbar({ filter, initialQ, sort, year, years }: Props) {
  return (
    <DashboardToolbar
      chips={
        <FilterRowNav
          label="Filter payments by status"
          scroll={false}
          items={PAYMENTS_STATUS_FILTER_OPTIONS.map((opt) => ({
            id: opt.value,
            label: opt.label,
            href: paymentsFilterHref(PAGE_PATH, opt.value),
            active: opt.value === filter,
          }))}
        />
      }
      search={
        <PaymentsToolbar embedded initialQ={initialQ} sort={sort} year={year} years={years} />
      }
    />
  );
}
